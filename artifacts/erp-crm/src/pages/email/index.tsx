import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Mail, Send, Inbox, Star, Trash2, FileText, Plus, X, Reply,
  ChevronLeft, Search, RefreshCw, Eye, EyeOff, Settings, RotateCcw, Loader2,
} from "lucide-react";
import { EmailSettingsModal } from "./settings-modal";

type Folder = "inbox" | "sent" | "draft" | "trash" | "starred";

interface Email {
  id: number;
  folder: string;
  fromAddress: string;
  fromName?: string;
  toAddress: string;
  toName?: string;
  ccAddress?: string;
  subject: string;
  body: string;
  isRead: boolean;
  isStarred: boolean;
  replyToId?: number;
  sentAt?: string;
  createdAt: string;
  companyId?: number;
}

interface ComposeData {
  toAddress: string;
  toName: string;
  ccAddress: string;
  subject: string;
  body: string;
  replyToId?: number;
}

const BASE = import.meta.env.BASE_URL;

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("erp_token");
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

const FOLDER_LABELS: Record<Folder, string> = {
  inbox: "Inbox", sent: "Sent", draft: "Drafts", trash: "Trash", starred: "Starred",
};

function formatDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" });
  if (diffDays < 7) return date.toLocaleDateString("en-AE", { weekday: "short" });
  return date.toLocaleDateString("en-AE", { day: "2-digit", month: "short" });
}

export function EmailPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const companyId: number = (user as any)?.companyId ?? 1;

  const [folder, setFolder] = useState<Folder>("inbox");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [compose, setCompose] = useState<ComposeData>({
    toAddress: "", toName: "", ccAddress: "", subject: "", body: "",
  });

  const { data: settings } = useQuery({
    queryKey: ["email-settings", companyId],
    queryFn: () => apiFetch(`/email-settings?companyId=${companyId}`),
  });

  const isConfigured = !!(settings?.imapHost && settings?.smtpHost);

  const emailsKey = ["emails", folder, search];
  const { data: emails = [], isLoading, refetch } = useQuery<Email[]>({
    queryKey: emailsKey,
    queryFn: () => {
      const params = new URLSearchParams(folder !== "starred" ? { folder } : {});
      if (search) params.set("search", search);
      return apiFetch(`/emails?${params}`);
    },
    refetchInterval: 60000,
  });

  const displayEmails = folder === "starred" ? emails.filter(e => e.isStarred) : emails;

  const { data: selectedEmail } = useQuery<Email>({
    queryKey: ["email", selectedId],
    queryFn: () => apiFetch(`/emails/${selectedId}`),
    enabled: !!selectedId,
  });

  const syncMutation = useMutation({
    mutationFn: () => apiFetch("/emails/sync", { method: "POST", body: JSON.stringify({ companyId }) }),
    onSuccess: (data) => {
      toast({ title: data.message ?? "Inbox synced!" });
      qc.invalidateQueries({ queryKey: ["emails"] });
      setFolder("inbox");
    },
    onError: (e: any) => {
      if (e.message?.includes("not configured")) {
        toast({ title: "Configure IMAP settings first.", variant: "destructive" });
        setShowSettings(true);
      } else {
        toast({ title: e.message, variant: "destructive" });
      }
    },
  });

  const sendMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/emails", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Email sent!" });
      setComposing(false);
      setCompose({ toAddress: "", toName: "", ccAddress: "", subject: "", body: "" });
      qc.invalidateQueries({ queryKey: ["emails"] });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const saveDraftMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/emails", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Draft saved." });
      setComposing(false);
      setCompose({ toAddress: "", toName: "", ccAddress: "", subject: "", body: "" });
      qc.invalidateQueries({ queryKey: ["emails"] });
    },
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: any }) =>
      apiFetch(`/emails/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emails"] });
      qc.invalidateQueries({ queryKey: ["email", selectedId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/emails/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["emails"] });
      toast({ title: "Email moved to trash." });
    },
  });

  const handleSelect = (email: Email) => {
    setSelectedId(email.id);
    setComposing(false);
    if (!email.isRead && email.folder === "inbox") {
      patchMutation.mutate({ id: email.id, patch: { isRead: true } });
    }
  };

  const handleReply = (email: Email) => {
    setCompose({
      toAddress: email.fromAddress,
      toName: email.fromName ?? "",
      ccAddress: "",
      subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
      body: `\n\n---\nOn ${formatDate(email.createdAt)}, ${email.fromName ?? email.fromAddress} wrote:\n${email.body.substring(0, 500)}`,
      replyToId: email.id,
    });
    setComposing(true);
    setSelectedId(null);
  };

  const handleSend = () => {
    if (!compose.toAddress || !compose.subject) {
      toast({ title: "To and Subject are required.", variant: "destructive" });
      return;
    }
    sendMutation.mutate({ ...compose, action: "send", companyId });
  };

  const unreadCount = emails.filter(e => !e.isRead && e.folder === "inbox").length;

  return (
    <>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white rounded-lg shadow-sm border border-gray-200">

        {/* ── Left Sidebar ── */}
        <div className="w-52 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
          <div className="p-3 space-y-2">
            <Button
              className="w-full bg-[#0f2d5a] hover:bg-[#1e6ab0] text-white font-semibold rounded-full shadow"
              onClick={() => {
                setComposing(true);
                setSelectedId(null);
                setCompose({ toAddress: "", toName: "", ccAddress: "", subject: "", body: "" });
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Compose
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
              {syncMutation.isPending ? "Syncing…" : "Sync Inbox"}
            </Button>
          </div>

          <nav className="flex-1 px-2 space-y-0.5">
            {(["inbox", "starred", "sent", "draft", "trash"] as Folder[]).map(f => (
              <button
                key={f}
                onClick={() => { setFolder(f); setSelectedId(null); setComposing(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${folder === f ? "bg-[#1e6ab0] text-white font-medium" : "text-gray-600 hover:bg-gray-200"}`}
              >
                {f === "inbox" && <Inbox className="w-4 h-4" />}
                {f === "sent" && <Send className="w-4 h-4" />}
                {f === "draft" && <FileText className="w-4 h-4" />}
                {f === "trash" && <Trash2 className="w-4 h-4" />}
                {f === "starred" && <Star className="w-4 h-4" />}
                <span className="flex-1 text-left">{FOLDER_LABELS[f]}</span>
                {f === "inbox" && unreadCount > 0 && (
                  <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 ${folder === "inbox" ? "bg-white/20 text-white" : "bg-[#0f2d5a] text-white"}`}>
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Bottom: account status + settings */}
          <div className="p-3 border-t border-gray-200 space-y-1.5">
            <div className={`flex items-center gap-1.5 text-xs px-1 ${isConfigured ? "text-green-600" : "text-amber-600"}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isConfigured ? "bg-green-500" : "bg-amber-400"}`} />
              {isConfigured ? "Account connected" : "Not connected"}
            </div>
            {settings?.lastSyncedAt && (
              <div className="text-[10px] text-gray-400 px-1">
                Last sync: {formatDate(settings.lastSyncedAt)}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="w-3 h-3 mr-1.5" /> Email Settings
            </Button>
          </div>
        </div>

        {/* ── Email List ── */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[#0f2d5a] text-sm">{FOLDER_LABELS[folder]}</h2>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetch()}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
              <Input
                className="pl-8 h-8 text-xs"
                placeholder="Search emails…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            )}
            {!isLoading && displayEmails.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                <Mail className="w-8 h-8 opacity-30" />
                <span className="text-sm">No emails here</span>
                {folder === "inbox" && !isConfigured && (
                  <Button variant="link" size="sm" className="text-xs" onClick={() => setShowSettings(true)}>
                    Connect your email account
                  </Button>
                )}
                {folder === "inbox" && isConfigured && (
                  <Button variant="link" size="sm" className="text-xs" onClick={() => syncMutation.mutate()}>
                    Sync now
                  </Button>
                )}
              </div>
            )}
            {displayEmails.map(email => (
              <button
                key={email.id}
                onClick={() => handleSelect(email)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-100 transition-colors hover:bg-blue-50
                  ${selectedId === email.id ? "bg-blue-100 border-l-2 border-l-[#1e6ab0]" : ""}
                  ${!email.isRead && email.folder === "inbox" ? "bg-blue-50/60" : ""}`}
              >
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <span className={`text-xs truncate max-w-[160px] ${!email.isRead && email.folder === "inbox" ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                    {email.folder === "sent" ? email.toAddress : (email.fromName ?? email.fromAddress)}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {email.isStarred && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                    {!email.isRead && email.folder === "inbox" && <span className="w-2 h-2 rounded-full bg-[#1e6ab0]" />}
                    <span className="text-[10px] text-gray-400">{formatDate(email.createdAt)}</span>
                  </div>
                </div>
                <div className={`text-xs truncate mb-0.5 ${!email.isRead && email.folder === "inbox" ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                  {email.subject}
                </div>
                <div className="text-[11px] text-gray-400 truncate leading-tight">
                  {email.body.replace(/\n/g, " ").substring(0, 80)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Main Panel ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {composing ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
                <span className="font-semibold text-[#0f2d5a]">
                  {compose.replyToId ? "Reply" : "New Email"}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => saveDraftMutation.mutate({ ...compose, folder: "draft", companyId })}>
                    Save Draft
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                    onClick={handleSend}
                    disabled={sendMutation.isPending}
                  >
                    {sendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                    {sendMutation.isPending ? "Sending…" : "Send"}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setComposing(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">To *</Label>
                    <Input
                      value={compose.toAddress}
                      onChange={e => setCompose(p => ({ ...p, toAddress: e.target.value }))}
                      placeholder="recipient@email.com"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">CC</Label>
                    <Input
                      value={compose.ccAddress}
                      onChange={e => setCompose(p => ({ ...p, ccAddress: e.target.value }))}
                      placeholder="cc@email.com"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Subject *</Label>
                  <Input
                    value={compose.subject}
                    onChange={e => setCompose(p => ({ ...p, subject: e.target.value }))}
                    placeholder="Email subject"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Message</Label>
                  <Textarea
                    value={compose.body}
                    onChange={e => setCompose(p => ({ ...p, body: e.target.value }))}
                    placeholder="Write your message here…"
                    className="min-h-[340px] text-sm font-sans resize-y"
                  />
                </div>
                {!isConfigured && (
                  <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                    <span>SMTP not configured — email will be saved but not sent.</span>
                    <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={() => setShowSettings(true)}>Configure</Button>
                  </div>
                )}
              </div>
            </div>
          ) : selectedEmail ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-200 bg-gray-50 flex-wrap">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedId(null)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900 truncate">{selectedEmail.subject}</h2>
                </div>
                <div className="flex items-center gap-1.5">
                  {selectedEmail.folder !== "sent" && (
                    <Button variant="outline" size="sm" onClick={() => handleReply(selectedEmail)}>
                      <Reply className="w-3.5 h-3.5 mr-1" /> Reply
                    </Button>
                  )}
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => patchMutation.mutate({ id: selectedEmail.id, patch: { isStarred: !selectedEmail.isStarred } })}
                  >
                    <Star className={`w-4 h-4 ${selectedEmail.isStarred ? "fill-amber-400 text-amber-400" : "text-gray-400"}`} />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => patchMutation.mutate({ id: selectedEmail.id, patch: { isRead: !selectedEmail.isRead } })}
                  >
                    {selectedEmail.isRead ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                    onClick={() => deleteMutation.mutate(selectedEmail.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="px-5 py-3 border-b border-gray-100 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-[#0f2d5a] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {(selectedEmail.fromName ?? selectedEmail.fromAddress).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{selectedEmail.fromName ?? selectedEmail.fromAddress}</div>
                      <div className="text-xs text-gray-500">{selectedEmail.fromAddress}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        To: {selectedEmail.toAddress}
                        {selectedEmail.ccAddress && ` · CC: ${selectedEmail.ccAddress}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-gray-400">
                      {new Date(selectedEmail.createdAt).toLocaleString("en-AE", {
                        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                    {!selectedEmail.isRead && selectedEmail.folder === "inbox" && (
                      <Badge className="mt-1 text-[10px] bg-blue-100 text-blue-700">Unread</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                <div className="prose max-w-none text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                  {selectedEmail.body}
                </div>
              </div>

              <div className="border-t border-gray-200 px-5 py-3 bg-gray-50">
                <Button variant="outline" size="sm" onClick={() => handleReply(selectedEmail)} className="w-full text-gray-500 justify-start">
                  <Reply className="w-3.5 h-3.5 mr-2 text-gray-400" />
                  Click to reply to {selectedEmail.fromName ?? selectedEmail.fromAddress}…
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <Mail className="w-16 h-16 opacity-20" />
              <div className="text-center">
                <p className="font-medium text-gray-500">Select an email to read</p>
                <p className="text-sm mt-1">Or compose a new message</p>
              </div>
              {!isConfigured ? (
                <div className="mt-2 text-center space-y-2">
                  <p className="text-xs text-amber-600">No email account connected yet.</p>
                  <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={() => setShowSettings(true)}>
                    <Settings className="w-4 h-4 mr-2" /> Connect Email Account
                  </Button>
                </div>
              ) : (
                <Button className="mt-2 bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={() => { setComposing(true); setCompose({ toAddress: "", toName: "", ccAddress: "", subject: "", body: "" }); }}>
                  <Plus className="w-4 h-4 mr-2" /> Compose Email
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <EmailSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        companyId={companyId}
      />
    </>
  );
}
