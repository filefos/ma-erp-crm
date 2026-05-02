import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Mail, Send, Inbox, Star, Trash2, FileText, Plus, X, Reply,
  ChevronLeft, Search, RefreshCw, Eye, EyeOff, Settings,
  RotateCcw, Loader2, Paperclip, FileIcon, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  attachments?: Array<{ filename: string; contentType: string; size: number }>;
}

interface Attachment {
  filename: string;
  content: string; // base64
  contentType: string;
  size: number;
}

interface ComposeData {
  toAddress: string;
  toName: string;
  ccAddress: string;
  bccAddress: string;
  subject: string;
  body: string;
  replyToId?: number;
}

const BASE = import.meta.env.BASE_URL;
const MAX_ATTACH_MB = 10;

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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmailPanel({ companyId: companyIdProp }: { companyId?: number } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const companyId: number = companyIdProp ?? (user as any)?.companyId ?? 1;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [folder, setFolder] = useState<Folder>("inbox");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [compose, setCompose] = useState<ComposeData>({
    toAddress: "", toName: "", ccAddress: "", bccAddress: "", subject: "", body: "",
  });

  const { data: settings } = useQuery({
    queryKey: ["email-settings", companyId],
    queryFn: () => apiFetch(`/email-settings?companyId=${companyId}`),
  });

  const isConnected = !!(settings?.smtpHost && settings?.smtpUser);

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
      setAttachments([]);
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
      setAttachments([]);
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
      bccAddress: "",
      subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
      body: `\n\n---\nOn ${formatDate(email.createdAt)}, ${email.fromName ?? email.fromAddress} wrote:\n${email.body.substring(0, 500)}`,
      replyToId: email.id,
    });
    setAttachments([]);
    setShowCc(false);
    setShowBcc(false);
    setComposing(true);
    setSelectedId(null);
  };

  const handleSend = () => {
    if (!compose.toAddress || !compose.subject) {
      toast({ title: "To and Subject are required.", variant: "destructive" });
      return;
    }
    sendMutation.mutate({ ...compose, action: "send", companyId, attachments });
  };

  // File attachment handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const newAttachments: Attachment[] = [];
    for (const file of files) {
      if (file.size > MAX_ATTACH_MB * 1024 * 1024) {
        toast({ title: `${file.name} exceeds ${MAX_ATTACH_MB}MB limit.`, variant: "destructive" });
        continue;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // strip data:...;base64,
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      newAttachments.push({ filename: file.name, content: base64, contentType: file.type || "application/octet-stream", size: file.size });
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));

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
                setAttachments([]);
                setShowCc(false);
                setShowBcc(false);
                setCompose({ toAddress: "", toName: "", ccAddress: "", bccAddress: "", subject: "", body: "" });
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Compose
            </Button>
            <Button
              variant="outline" size="sm" className="w-full text-xs"
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
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                  ${folder === f ? "bg-[#1e6ab0] text-white font-medium" : "text-gray-600 hover:bg-gray-200"}`}
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

          {/* Account status */}
          <div className="p-3 border-t border-gray-200 space-y-2">
            {isConnected ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-green-600 px-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="truncate font-medium">{settings?.smtpUser}</span>
                </div>
                {settings?.lastSyncedAt && (
                  <div className="text-[10px] text-gray-400 px-1">Synced {formatDate(settings.lastSyncedAt)}</div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 px-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                Not connected
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setShowSettings(true)}>
              {isConnected
                ? <><Settings className="w-3 h-3 mr-1.5" /> Account Settings</>
                : <><Mail className="w-3 h-3 mr-1.5" /> Connect Email</>}
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
                <span className="text-sm">No emails</span>
                {folder === "inbox" && !isConnected && (
                  <Button variant="link" size="sm" className="text-xs" onClick={() => setShowSettings(true)}>
                    Connect email account
                  </Button>
                )}
                {folder === "inbox" && isConnected && (
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
                    {email.attachments && (email.attachments as any[]).length > 0 && <Paperclip className="w-2.5 h-2.5 text-gray-400" />}
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
            /* ── Outlook-style Compose ── */
            <div className="flex flex-col h-full bg-white">

              {/* ── Top action bar ── */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200">
                {/* Send split-button */}
                <div className="flex items-center rounded overflow-hidden border border-[#1e6ab0] shadow-sm">
                  <button
                    className="flex items-center gap-1.5 bg-[#1e6ab0] hover:bg-[#0f2d5a] text-white text-sm font-semibold px-4 py-1.5 transition-colors disabled:opacity-60"
                    onClick={handleSend}
                    disabled={sendMutation.isPending}
                  >
                    {sendMutation.isPending
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Send className="w-3.5 h-3.5" />}
                    <span>{sendMutation.isPending ? "Sending…" : "Send"}</span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="bg-[#1e6ab0] hover:bg-[#0f2d5a] text-white border-l border-[#1558a0] px-2 py-1.5 transition-colors">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[150px]">
                      <DropdownMenuItem onClick={() => saveDraftMutation.mutate({ ...compose, folder: "draft", companyId })}>
                        Save as Draft
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* From address */}
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <span className="text-gray-400 text-xs">From:</span>
                  <span className="font-medium text-gray-700">
                    {settings?.smtpUser ?? "Not connected"}
                  </span>
                  {settings?.smtpUser && <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                </div>

                <div className="flex-1" />

                {/* Right actions */}
                <button
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                  title="Discard"
                  onClick={() => { setComposing(false); setAttachments([]); setShowCc(false); setShowBcc(false); }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                  title="Close"
                  onClick={() => { setComposing(false); setAttachments([]); setShowCc(false); setShowBcc(false); }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── Fields ── */}
              <div className="flex-1 flex flex-col overflow-y-auto">

                {/* To */}
                <div className="flex items-center border-b border-gray-100 px-4">
                  <span className="text-sm text-gray-500 w-10 flex-shrink-0 py-3">To</span>
                  <input
                    type="text"
                    className="flex-1 text-sm text-gray-800 py-3 outline-none bg-transparent placeholder:text-gray-400"
                    placeholder="Add recipients"
                    value={compose.toAddress}
                    onChange={e => setCompose(p => ({ ...p, toAddress: e.target.value }))}
                  />
                  <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                    {!showCc && (
                      <button
                        className="text-xs text-gray-500 hover:text-[#1e6ab0] font-medium py-3 px-1"
                        onClick={() => setShowCc(true)}
                      >Cc</button>
                    )}
                    {!showBcc && (
                      <button
                        className="text-xs text-gray-500 hover:text-[#1e6ab0] font-medium py-3 px-1"
                        onClick={() => setShowBcc(true)}
                      >Bcc</button>
                    )}
                  </div>
                </div>

                {/* Cc */}
                {showCc && (
                  <div className="flex items-center border-b border-gray-100 px-4">
                    <span className="text-sm text-gray-500 w-10 flex-shrink-0 py-3">Cc</span>
                    <input
                      type="text"
                      className="flex-1 text-sm text-gray-800 py-3 outline-none bg-transparent placeholder:text-gray-400"
                      placeholder="Add Cc recipients"
                      value={compose.ccAddress}
                      onChange={e => setCompose(p => ({ ...p, ccAddress: e.target.value }))}
                      autoFocus
                    />
                    <button className="p-1.5 text-gray-400 hover:text-gray-600" onClick={() => { setShowCc(false); setCompose(p => ({ ...p, ccAddress: "" })); }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Bcc */}
                {showBcc && (
                  <div className="flex items-center border-b border-gray-100 px-4">
                    <span className="text-sm text-gray-500 w-10 flex-shrink-0 py-3">Bcc</span>
                    <input
                      type="text"
                      className="flex-1 text-sm text-gray-800 py-3 outline-none bg-transparent placeholder:text-gray-400"
                      placeholder="Add Bcc recipients"
                      value={compose.bccAddress}
                      onChange={e => setCompose(p => ({ ...p, bccAddress: e.target.value }))}
                      autoFocus
                    />
                    <button className="p-1.5 text-gray-400 hover:text-gray-600" onClick={() => { setShowBcc(false); setCompose(p => ({ ...p, bccAddress: "" })); }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Subject */}
                <div className="border-b border-gray-100 px-4">
                  <input
                    type="text"
                    className="w-full text-sm text-gray-800 py-3 outline-none bg-transparent placeholder:text-gray-400"
                    placeholder="Add a subject"
                    value={compose.subject}
                    onChange={e => setCompose(p => ({ ...p, subject: e.target.value }))}
                  />
                </div>

                {/* Body */}
                <div className="flex-1 px-4 pt-3">
                  <textarea
                    className="w-full h-full min-h-[220px] text-sm text-gray-800 outline-none bg-transparent resize-none placeholder:text-gray-400 font-sans"
                    placeholder="Write your message…"
                    value={compose.body}
                    onChange={e => setCompose(p => ({ ...p, body: e.target.value }))}
                  />
                </div>

                {/* Attachment chips */}
                {attachments.length > 0 && (
                  <div className="px-4 pt-1 pb-2 flex flex-wrap gap-2">
                    {attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-full pl-2.5 pr-1.5 py-1">
                        <FileIcon className="w-3.5 h-3.5 text-[#1e6ab0] flex-shrink-0" />
                        <span className="text-xs text-gray-700 max-w-[120px] truncate">{att.filename}</span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{formatBytes(att.size)}</span>
                        <button
                          className="ml-0.5 p-0.5 rounded-full hover:bg-gray-300 text-gray-500 flex-shrink-0"
                          onClick={() => removeAttachment(idx)}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom toolbar */}
                <div className="flex items-center gap-1 px-4 py-2.5 border-t border-gray-100">
                  <button
                    className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#1e6ab0] px-3 py-1.5 rounded hover:bg-gray-100 transition-colors font-medium"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="w-4 h-4" /> Attach
                  </button>
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
                  <span className="text-[11px] text-gray-400 ml-1">Max {MAX_ATTACH_MB}MB per file</span>

                  {!isConnected && (
                    <div className="ml-auto flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1">
                      <span>SMTP not configured</span>
                      <button className="underline font-medium hover:text-amber-900" onClick={() => setShowSettings(true)}>
                        Connect
                      </button>
                    </div>
                  )}
                </div>
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
                  <Button variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => patchMutation.mutate({ id: selectedEmail.id, patch: { isStarred: !selectedEmail.isStarred } })}
                  >
                    <Star className={`w-4 h-4 ${selectedEmail.isStarred ? "fill-amber-400 text-amber-400" : "text-gray-400"}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => patchMutation.mutate({ id: selectedEmail.id, patch: { isRead: !selectedEmail.isRead } })}
                  >
                    {selectedEmail.isRead ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
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

              {/* Attachment list on received email */}
              {selectedEmail.attachments && (selectedEmail.attachments as any[]).length > 0 && (
                <div className="px-5 py-2 border-b border-gray-100 bg-gray-50 flex flex-wrap gap-2">
                  {(selectedEmail.attachments as any[]).map((att, i) => (
                    <a
                      key={i}
                      href={att.content
                        ? `data:${att.contentType};base64,${att.content}`
                        : `${BASE}api/emails/${selectedEmail.id}/attachments/${i}`}
                      download={att.filename}
                      className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-md px-2.5 py-1.5 hover:bg-blue-50 hover:border-[#1e6ab0] transition-colors group"
                      title="Download attachment"
                    >
                      <Paperclip className="w-3 h-3 text-gray-400 group-hover:text-[#1e6ab0]" />
                      <span className="text-xs text-gray-700 max-w-[140px] truncate group-hover:text-[#1e6ab0]">{att.filename}</span>
                      <span className="text-[10px] text-gray-400">{formatBytes(att.size ?? 0)}</span>
                    </a>
                  ))}
                </div>
              )}

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
              {!isConnected ? (
                <div className="mt-2 text-center space-y-2">
                  <p className="text-xs text-amber-600">No email account connected yet.</p>
                  <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={() => setShowSettings(true)}>
                    <Mail className="w-4 h-4 mr-2" /> Connect Email Account
                  </Button>
                </div>
              ) : (
                <Button className="mt-2 bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={() => {
                  setComposing(true);
                  setAttachments([]);
                  setShowCc(false);
                  setShowBcc(false);
                  setCompose({ toAddress: "", toName: "", ccAddress: "", bccAddress: "", subject: "", body: "" });
                }}>
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
