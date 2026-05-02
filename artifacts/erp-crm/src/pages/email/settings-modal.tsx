import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Loader2, Wifi } from "lucide-react";

const BASE = import.meta.env.BASE_URL;

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${BASE}api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = JSON.parse(text).error ?? text; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

interface EmailSettingsModalProps {
  open: boolean;
  onClose: () => void;
  companyId: number;
}

interface Settings {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpFromName: string;
  smtpSecure: string;
  imapHost: string;
  imapPort: string;
  imapUser: string;
  imapPass: string;
  imapSecure: string;
}

const DEFAULT: Settings = {
  smtpHost: "", smtpPort: "587", smtpUser: "", smtpPass: "", smtpFromName: "", smtpSecure: "starttls",
  imapHost: "", imapPort: "993", imapUser: "", imapPass: "", imapSecure: "ssl",
};

const COMMON_PRESETS = [
  { label: "Custom / Manual", value: "custom" },
  { label: "Gmail", value: "gmail", smtp: { host: "smtp.gmail.com", port: "587", secure: "starttls" }, imap: { host: "imap.gmail.com", port: "993", secure: "ssl" } },
  { label: "Yahoo Mail", value: "yahoo", smtp: { host: "smtp.mail.yahoo.com", port: "587", secure: "starttls" }, imap: { host: "imap.mail.yahoo.com", port: "993", secure: "ssl" } },
  { label: "Outlook / Hotmail", value: "outlook", smtp: { host: "smtp-mail.outlook.com", port: "587", secure: "starttls" }, imap: { host: "imap-mail.outlook.com", port: "993", secure: "ssl" } },
  { label: "Zoho Mail", value: "zoho", smtp: { host: "smtp.zoho.com", port: "587", secure: "starttls" }, imap: { host: "imap.zoho.com", port: "993", secure: "ssl" } },
  { label: "Titan Mail", value: "titan", smtp: { host: "smtp.titan.email", port: "587", secure: "starttls" }, imap: { host: "imap.titan.email", port: "993", secure: "ssl" } },
];

type TestStatus = "idle" | "loading" | "success" | "error";

export function EmailSettingsModal({ open, onClose, companyId }: EmailSettingsModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings>(DEFAULT);
  const [preset, setPreset] = useState("");
  const [smtpTest, setSmtpTest] = useState<{ status: TestStatus; msg: string }>({ status: "idle", msg: "" });
  const [imapTest, setImapTest] = useState<{ status: TestStatus; msg: string }>({ status: "idle", msg: "" });

  const { data: existing } = useQuery({
    queryKey: ["email-settings", companyId],
    queryFn: () => apiFetch(`/email-settings?companyId=${companyId}`),
    enabled: open,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        smtpHost: existing.smtpHost ?? "",
        smtpPort: String(existing.smtpPort ?? 587),
        smtpUser: existing.smtpUser ?? "",
        smtpPass: existing.smtpPass ?? "",
        smtpFromName: existing.smtpFromName ?? "",
        smtpSecure: existing.smtpSecure ?? "starttls",
        imapHost: existing.imapHost ?? "",
        imapPort: String(existing.imapPort ?? 993),
        imapUser: existing.imapUser ?? "",
        imapPass: existing.imapPass ?? "",
        imapSecure: existing.imapSecure ?? "ssl",
      });
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: () => apiFetch("/email-settings", {
      method: "POST",
      body: JSON.stringify({ ...form, companyId }),
    }),
    onSuccess: () => {
      toast({ title: "Email settings saved!" });
      qc.invalidateQueries({ queryKey: ["email-settings"] });
      onClose();
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const applyPreset = (val: string) => {
    setPreset(val);
    const found = COMMON_PRESETS.find(p => p.value === val);
    if (!found || !found.smtp) return;
    setForm(f => ({
      ...f,
      smtpHost: found.smtp.host,
      smtpPort: found.smtp.port,
      smtpSecure: found.smtp.secure,
      imapHost: found.imap.host,
      imapPort: found.imap.port,
      imapSecure: found.imap.secure,
    }));
  };

  const testSmtp = async () => {
    setSmtpTest({ status: "loading", msg: "" });
    try {
      await apiFetch("/email-settings/test-smtp", { method: "POST", body: JSON.stringify({ companyId }) });
      setSmtpTest({ status: "success", msg: "SMTP connection successful!" });
    } catch (e: any) {
      setSmtpTest({ status: "error", msg: e.message });
    }
  };

  const testImap = async () => {
    setImapTest({ status: "loading", msg: "" });
    try {
      await apiFetch("/email-settings/test-imap", { method: "POST", body: JSON.stringify({ companyId }) });
      setImapTest({ status: "success", msg: "IMAP connection successful!" });
    } catch (e: any) {
      setImapTest({ status: "error", msg: e.message });
    }
  };

  const F = (key: keyof Settings) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#0f2d5a]">Email Account Settings</DialogTitle>
        </DialogHeader>

        {/* Provider Preset */}
        <div className="space-y-1.5 mb-2">
          <Label className="text-xs text-gray-500">Quick setup — choose your provider</Label>
          <Select value={preset} onValueChange={applyPreset}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select provider (optional)" />
            </SelectTrigger>
            <SelectContent>
              {COMMON_PRESETS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="smtp">
          <TabsList className="w-full">
            <TabsTrigger value="smtp" className="flex-1">Outgoing Mail (SMTP)</TabsTrigger>
            <TabsTrigger value="imap" className="flex-1">Incoming Mail (IMAP)</TabsTrigger>
          </TabsList>

          {/* SMTP */}
          <TabsContent value="smtp" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">SMTP Host *</Label>
                <Input {...F("smtpHost")} placeholder="smtp.example.com" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Port</Label>
                <Input {...F("smtpPort")} type="number" className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Encryption</Label>
              <Select value={form.smtpSecure} onValueChange={v => setForm(f => ({ ...f, smtpSecure: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starttls">STARTTLS (port 587)</SelectItem>
                  <SelectItem value="ssl">SSL / TLS (port 465)</SelectItem>
                  <SelectItem value="none">None (port 25)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Username / Email *</Label>
              <Input {...F("smtpUser")} placeholder="you@yourdomain.com" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Password / App Password *</Label>
              <Input {...F("smtpPass")} type="password" placeholder="••••••••" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Display Name (From Name)</Label>
              <Input {...F("smtpFromName")} placeholder="Prime Max ERP" className="h-8 text-sm" />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button variant="outline" size="sm" onClick={testSmtp} disabled={smtpTest.status === "loading"}>
                {smtpTest.status === "loading" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5 mr-1.5" />}
                Test Connection
              </Button>
              {smtpTest.status === "success" && <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="w-3.5 h-3.5" />{smtpTest.msg}</span>}
              {smtpTest.status === "error" && <span className="flex items-center gap-1 text-red-600 text-xs"><XCircle className="w-3.5 h-3.5" />{smtpTest.msg}</span>}
            </div>
          </TabsContent>

          {/* IMAP */}
          <TabsContent value="imap" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">IMAP Host *</Label>
                <Input {...F("imapHost")} placeholder="imap.example.com" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Port</Label>
                <Input {...F("imapPort")} type="number" className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Encryption</Label>
              <Select value={form.imapSecure} onValueChange={v => setForm(f => ({ ...f, imapSecure: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ssl">SSL / TLS (port 993)</SelectItem>
                  <SelectItem value="starttls">STARTTLS (port 143)</SelectItem>
                  <SelectItem value="none">None (port 143)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Username / Email *</Label>
              <Input {...F("imapUser")} placeholder="you@yourdomain.com" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Password / App Password *</Label>
              <Input {...F("imapPass")} type="password" placeholder="••••••••" className="h-8 text-sm" />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 text-xs text-amber-800">
              <strong>Tip:</strong> If using Gmail or Outlook, generate an <strong>App Password</strong> from your account security settings instead of your main password.
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button variant="outline" size="sm" onClick={testImap} disabled={imapTest.status === "loading"}>
                {imapTest.status === "loading" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5 mr-1.5" />}
                Test Connection
              </Button>
              {imapTest.status === "success" && <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="w-3.5 h-3.5" />{imapTest.msg}</span>}
              {imapTest.status === "error" && <span className="flex items-center gap-1 text-red-600 text-xs"><XCircle className="w-3.5 h-3.5" />{imapTest.msg}</span>}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
