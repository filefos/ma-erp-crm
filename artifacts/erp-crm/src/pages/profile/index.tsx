import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUpdateUser, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, Shield, Building2, Pencil, Check, X, Upload, Trash2, Sparkles } from "lucide-react";
import { getAutomationLevel, setAutomationLevel, type AutomationLevel } from "@/lib/ai-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LEVEL_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800",
  company_admin: "bg-purple-100 text-purple-800",
  department_admin: "bg-indigo-100 text-indigo-800",
  manager: "bg-blue-100 text-blue-800",
  user: "bg-emerald-100 text-emerald-800",
  data_entry: "bg-orange-100 text-orange-800",
  viewer: "bg-slate-100 text-slate-800",
};

export function MyProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [saved, setSaved] = useState(false);

  // Signature state
  const [sigPreview, setSigPreview] = useState<string | null>(null);
  const [sigSavedUrl, setSigSavedUrl] = useState<string | null>(null);
  const [sigSaving, setSigSaving] = useState(false);
  const [sigSaved, setSigSaved] = useState(false);
  const [sigClearing, setSigClearing] = useState(false);
  const [sigCleared, setSigCleared] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = localStorage.getItem("erp_token");
  const sigDirty = sigPreview !== sigSavedUrl;

  // AI automation level
  const [autoLevel, setAutoLevel] = useState<AutomationLevel>("suggest");
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getAutomationLevel().then(r => { if (!cancelled) setAutoLevel(r.automationLevel); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (window.location.hash === "#signature") {
      setTimeout(() => {
        document.getElementById("signature")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, []);
  const onChangeAutoLevel = async (v: AutomationLevel) => {
    setAutoLevel(v);
    setAutoSaving(true);
    try {
      await setAutomationLevel(v);
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2500);
    } finally {
      setAutoSaving(false);
    }
  };

  const u = user as {
    id: number; name: string; email: string; phone?: string | null;
    role?: string; permissionLevel?: string;
    companyId?: number | null; department?: { name: string } | null;
    signatureUrl?: string | null;
  } | undefined;

  useEffect(() => {
    if (u) {
      setForm({ name: u.name ?? "", email: u.email ?? "", phone: u.phone ?? "" });
      const saved = u.signatureUrl ?? null;
      setSigPreview(saved);
      setSigSavedUrl(saved);
    }
  }, [u?.id, u?.signatureUrl]);

  const update = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      },
    },
  });

  if (!u) return null;

  const level = u.permissionLevel ?? "user";
  const initial = u.name?.charAt(0)?.toUpperCase() ?? "U";

  const handleSave = () => {
    if (!form.name.trim()) return;
    update.mutate({ id: u.id, data: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null } as any });
  };

  const handleCancel = () => {
    setForm({ name: u.name ?? "", email: u.email ?? "", phone: u.phone ?? "" });
    setEditing(false);
  };

  const handleSignatureFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setSigPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSignature = async () => {
    if (!sigPreview) return;
    setSigSaving(true);
    try {
      const res = await fetch(`/api/users/${u.id}/signature`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ signatureUrl: sigPreview }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert((err as { error?: string }).error ?? "Failed to save signature. Please try again.");
        return;
      }
      setSigSavedUrl(sigPreview);
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setSigSaved(true);
      setTimeout(() => setSigSaved(false), 3000);
    } finally {
      setSigSaving(false);
    }
  };

  const handleClearSignature = async () => {
    setSigClearing(true);
    try {
      const res = await fetch(`/api/users/${u.id}/signature`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ signatureUrl: null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert((err as { error?: string }).error ?? "Failed to clear signature. Please try again.");
        return;
      }
      setSigPreview(null);
      setSigSavedUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setSigCleared(true);
      setTimeout(() => setSigCleared(false), 3000);
    } finally {
      setSigClearing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your personal information and account details.</p>
      </div>

      {/* Avatar & identity card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#1e6ab0] flex items-center justify-center text-white text-2xl font-bold shrink-0 ring-2 ring-[#1e6ab0]/20">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold truncate">{u.name}</h2>
              <p className="text-sm text-muted-foreground truncate">{u.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge className={LEVEL_COLORS[level] ?? "bg-slate-100 text-slate-800"}>
                  {level.replace(/_/g, " ")}
                </Badge>
                {u.role && (
                  <Badge variant="outline" className="capitalize">{u.role}</Badge>
                )}
              </div>
            </div>
            {saved && (
              <div className="flex items-center gap-1 text-emerald-600 text-sm">
                <Check className="w-4 h-4" /> Saved
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Personal Details */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Personal Details</CardTitle>
            <CardDescription>Your name, email address, and phone number.</CardDescription>
          </div>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="w-3.5 h-3.5 mr-1.5" /> Cancel
              </Button>
              <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={handleSave} disabled={update.isPending || !form.name.trim()}>
                <Check className="w-3.5 h-3.5 mr-1.5" />
                {update.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground"><User className="w-3.5 h-3.5" /> Full Name</Label>
              {editing ? (
                <Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Full name" />
              ) : (
                <p className="text-sm font-medium">{u.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="w-3.5 h-3.5" /> Email Address</Label>
              {editing ? (
                <Input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} placeholder="your@email.com" />
              ) : (
                <p className="text-sm font-medium">{u.email}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="w-3.5 h-3.5" /> Phone Number</Label>
              {editing ? (
                <Input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} placeholder="+971 XX XXX XXXX" />
              ) : (
                <p className="text-sm font-medium">{u.phone || <span className="text-muted-foreground italic">Not set</span>}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signature */}
      <Card id="signature">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">My Signature</CardTitle>
          <CardDescription>Upload your signature image. It will appear on printed documents (quotations, invoices, POs, etc.).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sigPreview ? (
            <div className="border rounded-lg p-4 bg-muted/30 flex items-center gap-4">
              <img src={sigPreview} alt="Signature" className="h-16 object-contain rounded border bg-white p-1" style={{ maxWidth: 220 }} />
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />Change
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleClearSignature}
                  disabled={sigClearing}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  {sigClearing ? "Clearing…" : "Clear"}
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-[#1e6ab0]/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Click to upload signature image</p>
              <p className="text-xs text-muted-foreground mt-1">PNG or JPG (transparent PNG recommended)</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="hidden"
            onChange={handleSignatureFile}
          />
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
              onClick={handleSaveSignature}
              disabled={!sigPreview || !sigDirty || sigSaving}
            >
              <Check className="w-3.5 h-3.5 mr-1.5" />
              {sigSaving ? "Saving..." : "Save Signature"}
            </Button>
            {sigSaved && <span className="text-sm text-emerald-600 flex items-center gap-1"><Check className="w-4 h-4" />Signature saved!</span>}
            {sigCleared && <span className="text-sm text-emerald-600 flex items-center gap-1"><Check className="w-4 h-4" />Signature cleared.</span>}
          </div>
        </CardContent>
      </Card>

      {/* AI Automation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#1e6ab0]" />AI Automation Level</CardTitle>
          <CardDescription>How much should the assistant do for you on overdue follow-ups and reminders?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-[260px_1fr] gap-4 items-start">
            <Select value={autoLevel} onValueChange={(v) => onChangeAutoLevel(v as AutomationLevel)}>
              <SelectTrigger data-testid="select-automation-level"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off — no AI suggestions or alerts</SelectItem>
                <SelectItem value="suggest">Suggest — show drafts on demand</SelectItem>
                <SelectItem value="auto_with_approval">Auto with approval — notify me when due</SelectItem>
                <SelectItem value="fully_automatic">Fully automatic — send WhatsApp follow-ups for me</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><b>Suggest</b> — buttons like "Suggest reply" and "Suggest next follow-up" use AI when you click them.</p>
              <p><b>Auto with approval</b> — you also get a notification when a lead's follow-up date passes or an invoice goes overdue.</p>
              <p><b>Fully automatic</b> — for overdue lead follow-ups with a WhatsApp number, the assistant will send a friendly message on your behalf and log it.</p>
              {autoSaving && <p className="text-blue-600">Saving…</p>}
              {autoSaved && <p className="text-emerald-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" />Saved</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Access & Permissions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Access &amp; Permissions</CardTitle>
          <CardDescription>Your role and permission level are managed by the administrator.</CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Permission Level</p>
              <Badge className={LEVEL_COLORS[level] ?? "bg-slate-100 text-slate-800"}>
                {level.replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Department Role</p>
              <p className="font-medium capitalize">{u.role ?? "—"}</p>
            </div>
            {u.department && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Department</p>
                <p className="font-medium">{u.department.name}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
