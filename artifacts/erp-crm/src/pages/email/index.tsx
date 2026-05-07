import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Mail, Send, Inbox, Star, Trash2, FileText, Plus, X, Reply,
  Search, RefreshCw, Eye, EyeOff, Settings, RotateCcw, Loader2,
  Paperclip, FileIcon, ChevronDown, ChevronRight, Flag, Archive,
  MoreHorizontal, Forward, AlertCircle, Bold, Italic, Underline,
  Link as LinkIcon, Smile,
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
  attachments?: Array<{ filename: string; contentType: string; size: number }>;
}

interface Attachment {
  filename: string;
  content: string;
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

function groupByDate(emails: Email[]): { label: string; items: Email[] }[] {
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const thisWeekStart = new Date(today); thisWeekStart.setDate(today.getDate() - today.getDay());

  const groups: Record<string, Email[]> = {};
  for (const email of emails) {
    const d = new Date(email.createdAt);
    let label: string;
    if (d >= today) label = "Today";
    else if (d >= yesterday) label = "Yesterday";
    else if (d >= thisWeekStart) label = "This Week";
    else label = d.toLocaleDateString("en-AE", { month: "long", year: "numeric" });
    if (!groups[label]) groups[label] = [];
    groups[label].push(email);
  }
  const order = ["Today", "Yesterday", "This Week"];
  const sorted = Object.entries(groups).sort(([a], [b]) => {
    const ai = order.indexOf(a), bi = order.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return b.localeCompare(a);
  });
  return sorted.map(([label, items]) => ({ label, items }));
}

/* ── Outlook envelope SVG ──────────────────────────────────────────────────── */
function OutlookEnvelope() {
  return (
    <svg width="96" height="72" viewBox="0 0 96 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="env-body" x1="0" y1="0" x2="96" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c5cae9" />
          <stop offset="100%" stopColor="#9fa8da" />
        </linearGradient>
        <linearGradient id="env-flap" x1="0" y1="0" x2="96" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#b0bec5" />
          <stop offset="100%" stopColor="#90a4ae" />
        </linearGradient>
        <linearGradient id="env-inner" x1="0" y1="0" x2="0" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e8eaf6" />
          <stop offset="100%" stopColor="#c5cae9" />
        </linearGradient>
      </defs>
      {/* Envelope body */}
      <rect x="4" y="20" width="88" height="48" rx="4" fill="url(#env-body)" />
      {/* Inner white area */}
      <rect x="8" y="24" width="80" height="40" rx="2" fill="url(#env-inner)" />
      {/* Fold lines suggesting paper */}
      <line x1="20" y1="36" x2="76" y2="36" stroke="#b0bec5" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="42" x2="60" y2="42" stroke="#b0bec5" strokeWidth="1.5" strokeLinecap="round" />
      {/* Open flap */}
      <path d="M4 20 L48 4 L92 20" fill="url(#env-flap)" />
      <path d="M4 20 L48 4 L92 20 L4 20 Z" fill="none" stroke="#8e99a4" strokeWidth="0.5" />
    </svg>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
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
  const [accountExpanded, setAccountExpanded] = useState(true);
  const [favExpanded, setFavExpanded] = useState(true);
  const [compose, setCompose] = useState<ComposeData>({
    toAddress: "", toName: "", ccAddress: "", bccAddress: "", subject: "", body: "",
  });

  const { data: settings } = useQuery({
    queryKey: ["email-settings", companyId],
    queryFn: () => apiFetch(`/email-settings?companyId=${companyId}`),
  });

  const isConnected = !!(settings?.smtpHost && settings?.smtpUser);
  const accountEmail = settings?.smtpUser ?? (companyId === 1 ? "info@primemaxprefab.com" : "info@eliteprefab.com");

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
  const groups = groupByDate(displayEmails);

  const { data: selectedEmail } = useQuery<Email>({
    queryKey: ["email", selectedId],
    queryFn: () => apiFetch(`/emails/${selectedId}`),
    enabled: !!selectedId,
  });

  // folder unread counts
  const { data: inboxEmails = [] } = useQuery<Email[]>({
    queryKey: ["emails", "inbox", ""],
    queryFn: () => apiFetch("/emails?folder=inbox"),
    refetchInterval: 60000,
  });
  const { data: draftEmails = [] } = useQuery<Email[]>({
    queryKey: ["emails", "draft", ""],
    queryFn: () => apiFetch("/emails?folder=draft"),
  });
  const { data: trashEmails = [] } = useQuery<Email[]>({
    queryKey: ["emails", "trash", ""],
    queryFn: () => apiFetch("/emails?folder=trash"),
  });

  const inboxUnread = inboxEmails.filter(e => !e.isRead).length;
  const draftCount = draftEmails.length;
  const trashCount = trashEmails.length;

  const folderCounts: Record<string, number> = {
    inbox: inboxUnread,
    draft: draftCount,
    trash: trashCount,
  };

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
      setCompose({ toAddress: "", toName: "", ccAddress: "", bccAddress: "", subject: "", body: "" });
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
      setCompose({ toAddress: "", toName: "", ccAddress: "", bccAddress: "", subject: "", body: "" });
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
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      newAttachments.push({ filename: file.name, content: base64, contentType: file.type || "application/octet-stream", size: file.size });
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));

  const openCompose = () => {
    setComposing(true);
    setSelectedId(null);
    setAttachments([]);
    setShowCc(false);
    setShowBcc(false);
    setCompose({ toAddress: "", toName: "", ccAddress: "", bccAddress: "", subject: "", body: "" });
  };

  const FOLDERS: { key: Folder; label: string; icon: React.ReactNode }[] = [
    { key: "inbox",   label: "Inbox",     icon: <Inbox   className="w-4 h-4" /> },
    { key: "sent",    label: "Sent Items", icon: <Send    className="w-4 h-4" /> },
    { key: "draft",   label: "Drafts",    icon: <FileText className="w-4 h-4" /> },
    { key: "trash",   label: "Deleted Items", icon: <Trash2 className="w-4 h-4" /> },
    { key: "starred", label: "Starred",   icon: <Star    className="w-4 h-4" /> },
  ];

  /* ── Avatar initial ─────────────────────────────────────────────────────── */
  const avatarInitial = (name?: string, addr?: string) =>
    (name ?? addr ?? "?").charAt(0).toUpperCase();

  return (
    <>
      <div
        className="flex overflow-hidden bg-white"
        style={{ height: "calc(100vh - 120px)", fontFamily: "'Segoe UI', system-ui, sans-serif" }}
      >

        {/* ════════════════════════════════════════════════════════════════════
            LEFT SIDEBAR — folder tree (Outlook style)
        ════════════════════════════════════════════════════════════════════ */}
        <div
          className="flex flex-col border-r"
          style={{ width: 220, minWidth: 220, background: "#ffffff", borderColor: "#e1dfdd" }}
        >
          {/* New mail button */}
          <div className="px-3 pt-3 pb-2">
            <button
              onClick={openCompose}
              className="flex items-center gap-2 w-full text-[13px] font-semibold rounded px-3 py-2 transition-colors"
              style={{ background: "#0078d4", color: "#fff" }}
            >
              <Plus className="w-4 h-4" />
              New mail
            </button>
          </div>

          {/* Sync button */}
          <div className="px-3 pb-2">
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex items-center gap-2 w-full text-[12px] rounded px-3 py-1.5 transition-colors border"
              style={{ borderColor: "#e1dfdd", color: "#605e5c" }}
            >
              {syncMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RotateCcw className="w-3.5 h-3.5" />}
              {syncMutation.isPending ? "Syncing…" : "Sync inbox"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* Favorites section */}
            <div className="mb-1">
              <button
                className="flex items-center gap-1 w-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide select-none"
                style={{ color: "#605e5c" }}
                onClick={() => setFavExpanded(s => !s)}
              >
                {favExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Favorites
              </button>
              {favExpanded && (
                <div>
                  {["inbox", "sent", "starred"].map(fk => {
                    const f = FOLDERS.find(x => x.key === fk)!;
                    const count = folderCounts[f.key] ?? 0;
                    const active = folder === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => { setFolder(f.key); setSelectedId(null); setComposing(false); }}
                        className="flex items-center w-full px-5 py-1.5 text-[13px] transition-colors"
                        style={{
                          background: active ? "#dce9f8" : "transparent",
                          color: active ? "#0078d4" : "#323130",
                          fontWeight: active ? 600 : 400,
                          borderRight: active ? "2px solid #0078d4" : "2px solid transparent",
                        }}
                      >
                        <span className="flex-1 text-left truncate">{f.label}</span>
                        {count > 0 && (
                          <span className="text-[11px] font-semibold" style={{ color: active ? "#0078d4" : "#323130" }}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Account section */}
            <div>
              <button
                className="flex items-center gap-1 w-full px-3 py-1 text-[12px] font-semibold select-none"
                style={{ color: "#323130" }}
                onClick={() => setAccountExpanded(s => !s)}
              >
                {accountExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                    style={{ background: "#0078d4" }}
                  >
                    {accountEmail.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate max-w-[130px]">{accountEmail}</span>
                </span>
                {isConnected ? (
                  <span className="ml-auto w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Connected" />
                ) : (
                  <span className="ml-auto w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" title="Not connected" />
                )}
              </button>

              {accountExpanded && (
                <div>
                  {FOLDERS.map(f => {
                    const count = folderCounts[f.key] ?? 0;
                    const active = folder === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => { setFolder(f.key); setSelectedId(null); setComposing(false); }}
                        className="flex items-center gap-2 w-full px-6 py-1.5 text-[13px] transition-colors"
                        style={{
                          background: active ? "#dce9f8" : "transparent",
                          color: active ? "#0078d4" : "#323130",
                          fontWeight: active ? 600 : 400,
                          borderRight: active ? "2px solid #0078d4" : "2px solid transparent",
                        }}
                      >
                        <span style={{ color: active ? "#0078d4" : "#605e5c" }}>{f.icon}</span>
                        <span className="flex-1 text-left truncate">{f.label}</span>
                        {count > 0 && (
                          <span className="text-[11px] font-semibold" style={{ color: active ? "#0078d4" : "#323130" }}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  <button
                    className="flex items-center gap-2 w-full px-6 py-1.5 text-[13px] transition-colors"
                    style={{ color: "#605e5c" }}
                  >
                    <Archive className="w-4 h-4" />
                    <span className="flex-1 text-left">Archive</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom: settings */}
          <div className="border-t px-3 py-2" style={{ borderColor: "#e1dfdd" }}>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 w-full text-[12px] px-2 py-1.5 rounded transition-colors hover:bg-gray-100"
              style={{ color: "#605e5c" }}
            >
              <Settings className="w-3.5 h-3.5" />
              {isConnected ? "Account settings" : "Connect email"}
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            MIDDLE PANE — email list
        ════════════════════════════════════════════════════════════════════ */}
        <div
          className="flex flex-col border-r flex-shrink-0"
          style={{ width: 320, background: "#ffffff", borderColor: "#e1dfdd" }}
        >
          {/* Header */}
          <div className="px-4 pt-3 pb-0 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-semibold" style={{ color: "#323130" }}>
                  {FOLDERS.find(f => f.key === folder)?.label ?? folder}
                </span>
                {folder === "inbox" && (
                  <button
                    onClick={() => patchMutation.mutate({ id: -1, patch: {} })}
                    className="opacity-40 hover:opacity-100 transition-opacity"
                    title="Mark as favourite"
                  >
                    <Star className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => refetch()}
                  className="p-1.5 rounded transition-colors hover:bg-gray-100"
                  style={{ color: "#605e5c" }}
                  title="Refresh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button className="p-1.5 rounded transition-colors hover:bg-gray-100" style={{ color: "#605e5c" }}>
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#605e5c" }} />
              <input
                className="w-full text-[13px] rounded pl-8 pr-3 py-1.5 outline-none border"
                style={{
                  background: "#f3f2f1",
                  borderColor: "transparent",
                  color: "#323130",
                  fontFamily: "'Segoe UI', system-ui, sans-serif",
                }}
                placeholder="Search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={e => (e.target.style.borderColor = "#0078d4")}
                onBlur={e => (e.target.style.borderColor = "transparent")}
              />
            </div>

            {/* Filter row */}
            <div className="flex items-center justify-between pb-1.5">
              <div className="flex items-center gap-0">
                <button className="text-[13px] font-semibold pb-1.5 mr-3 border-b-2" style={{ color: "#0078d4", borderColor: "#0078d4" }}>
                  Focused
                </button>
                <button className="text-[13px] pb-1.5 border-b-2 border-transparent" style={{ color: "#605e5c" }}>
                  Other
                </button>
              </div>
              <div className="flex items-center gap-1 text-[12px]" style={{ color: "#605e5c" }}>
                <button className="hover:text-[#0078d4] p-0.5" title="Filter"><Flag className="w-3.5 h-3.5" /></button>
                <button className="hover:text-[#0078d4] p-0.5" title="Sort"><ChevronDown className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>

          <div className="h-px" style={{ background: "#e1dfdd" }} />

          {/* Email list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center h-32 gap-2" style={{ color: "#605e5c" }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[13px]">Loading…</span>
              </div>
            )}

            {!isLoading && displayEmails.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <Mail className="w-10 h-10 opacity-20" style={{ color: "#605e5c" }} />
                <div className="text-center">
                  <p className="text-[13px]" style={{ color: "#323130" }}>No messages</p>
                  {folder === "inbox" && !isConnected && (
                    <button
                      className="text-[12px] mt-1 underline"
                      style={{ color: "#0078d4" }}
                      onClick={() => setShowSettings(true)}
                    >Connect email account</button>
                  )}
                </div>
              </div>
            )}

            {groups.map(({ label, items }) => (
              <div key={label}>
                {/* Date group header */}
                <div
                  className="px-4 py-1 text-[11px] font-semibold sticky top-0 z-10"
                  style={{ background: "#f3f2f1", color: "#605e5c" }}
                >
                  {label}
                </div>

                {items.map(email => {
                  const isSelected = selectedId === email.id;
                  const isUnread = !email.isRead && email.folder === "inbox";
                  const displayName = email.folder === "sent"
                    ? (email.toName ?? email.toAddress)
                    : (email.fromName ?? email.fromAddress);

                  return (
                    <button
                      key={email.id}
                      onClick={() => handleSelect(email)}
                      className="w-full text-left px-4 py-2.5 transition-colors relative"
                      style={{
                        background: isSelected ? "#dce9f8" : "transparent",
                        borderLeft: isSelected ? "3px solid #0078d4" : "3px solid transparent",
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#f3f2f1"; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <div className="flex items-start gap-2">
                        {/* Unread dot */}
                        <div className="flex-shrink-0 mt-1.5">
                          {isUnread
                            ? <span className="w-2 h-2 rounded-full block" style={{ background: "#0078d4" }} />
                            : <span className="w-2 h-2 block" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Row 1: sender + time */}
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className="text-[13px] truncate max-w-[160px]"
                              style={{
                                color: "#323130",
                                fontWeight: isUnread ? 700 : 400,
                              }}
                            >
                              {displayName}
                            </span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {email.attachments && (email.attachments as any[]).length > 0 && (
                                <Paperclip className="w-3 h-3" style={{ color: "#605e5c" }} />
                              )}
                              {email.isStarred && <Star className="w-3 h-3 fill-orange-400 text-orange-400" />}
                              <span className="text-[11px]" style={{ color: "#605e5c" }}>
                                {formatDate(email.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Row 2: subject */}
                          <div
                            className="text-[13px] truncate"
                            style={{
                              color: "#323130",
                              fontWeight: isUnread ? 600 : 400,
                            }}
                          >
                            {email.subject || "(no subject)"}
                          </div>

                          {/* Row 3: preview */}
                          <div className="text-[12px] truncate" style={{ color: "#605e5c" }}>
                            {email.body.replace(/\n/g, " ").substring(0, 80)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            RIGHT PANE — compose / reading / empty
        ════════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">

          {composing ? (
            /* ── Compose — full Outlook-style ─────────────────────────────── */
            <div className="flex flex-col h-full">

              {/* Ribbon */}
              <div className="flex items-center px-2 py-0.5 border-b flex-shrink-0 gap-0.5" style={{ borderColor: "#e1dfdd" }}>
                <label className="cursor-pointer">
                  <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                  <span className="flex flex-col items-center gap-0.5 px-2 py-1 rounded hover:bg-gray-100 min-w-[48px] cursor-pointer text-[#444]">
                    <Paperclip className="w-4 h-4" />
                    <span className="text-[9px]">Attach File</span>
                  </span>
                </label>
                <span className="flex flex-col items-center gap-0.5 px-2 py-1 rounded hover:bg-gray-100 min-w-[36px] cursor-pointer text-[#444]">
                  <Smile className="w-4 h-4" /><span className="text-[9px]">Emoji</span>
                </span>
                <span className="flex flex-col items-center gap-0.5 px-2 py-1 rounded hover:bg-gray-100 min-w-[36px] cursor-pointer text-[#444]">
                  <LinkIcon className="w-4 h-4" /><span className="text-[9px]">Link</span>
                </span>
                <div className="w-px h-8 bg-gray-200 mx-1 self-center" />
                <span className="flex flex-col items-center gap-0.5 px-2 py-1 rounded hover:bg-gray-100 min-w-[36px] cursor-pointer text-[#444]">
                  <Bold className="w-4 h-4" /><span className="text-[9px]">Bold</span>
                </span>
                <span className="flex flex-col items-center gap-0.5 px-2 py-1 rounded hover:bg-gray-100 min-w-[36px] cursor-pointer text-[#444]">
                  <Italic className="w-4 h-4" /><span className="text-[9px]">Italic</span>
                </span>
                <span className="flex flex-col items-center gap-0.5 px-2 py-1 rounded hover:bg-gray-100 min-w-[36px] cursor-pointer text-[#444]">
                  <Underline className="w-4 h-4" /><span className="text-[9px]">Underline</span>
                </span>
                <div className="w-px h-8 bg-gray-200 mx-1 self-center" />
                <span className="flex flex-col items-center gap-0.5 px-2 py-1 rounded hover:bg-gray-100 min-w-[36px] cursor-pointer text-[#444]">
                  <AlertCircle className="w-4 h-4 text-red-400" /><span className="text-[9px]">High</span>
                </span>
              </div>

              {/* Send row */}
              <div className="flex items-center px-4 py-2 border-b flex-shrink-0 gap-3" style={{ borderColor: "#e1dfdd" }}>
                <button
                  onClick={handleSend}
                  disabled={sendMutation.isPending}
                  className="flex items-center rounded overflow-hidden flex-shrink-0 focus:outline-none"
                  style={{ border: "1px solid #005a9e" }}
                >
                  <span
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-semibold text-white"
                    style={{ background: "#0078d4" }}
                  >
                    {sendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2l14 6-14 6V9.5l10-1.5-10-1.5V2z"/></svg>}
                    {sendMutation.isPending ? "Sending…" : "Send"}
                  </span>
                  <span className="px-2 py-1.5 text-white border-l" style={{ background: "#0078d4", borderColor: "rgba(255,255,255,0.3)" }}>
                    <ChevronDown className="w-3 h-3" />
                  </span>
                </button>

                <div className="flex items-center gap-1 text-[13px]" style={{ color: "#323130" }}>
                  <span style={{ color: "#605e5c" }}>From:</span>
                  <span className="font-medium">{settings?.smtpUser ?? accountEmail}</span>
                </div>

                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => saveDraftMutation.mutate({ ...compose, folder: "draft", companyId })}
                    className="p-1.5 rounded transition-colors hover:bg-gray-100"
                    style={{ color: "#605e5c" }}
                    title="Save draft"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setComposing(false); setAttachments([]); }}
                    className="p-1.5 rounded transition-colors hover:bg-gray-100"
                    style={{ color: "#605e5c" }}
                    title="Discard"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setComposing(false); setAttachments([]); }}
                    className="p-1.5 rounded transition-colors hover:bg-gray-100"
                    style={{ color: "#605e5c" }}
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* To */}
              <div className="flex items-center px-4 border-b flex-shrink-0" style={{ borderColor: "#e1dfdd", minHeight: 40 }}>
                <span className="text-[13px] w-10 flex-shrink-0" style={{ color: "#605e5c" }}>To</span>
                <input
                  type="text"
                  className="flex-1 text-[13px] py-2.5 outline-none bg-transparent"
                  style={{ color: "#323130", fontFamily: "'Segoe UI', system-ui, sans-serif" }}
                  value={compose.toAddress}
                  onChange={e => setCompose(p => ({ ...p, toAddress: e.target.value }))}
                />
                <div className="flex items-center gap-3 flex-shrink-0">
                  {!showCc && <button className="text-[13px] font-normal" style={{ color: "#0078d4" }} onClick={() => setShowCc(true)}>Cc</button>}
                  {!showBcc && <button className="text-[13px] font-normal" style={{ color: "#0078d4" }} onClick={() => setShowBcc(true)}>Bcc</button>}
                </div>
              </div>

              {showCc && (
                <div className="flex items-center px-4 border-b flex-shrink-0" style={{ borderColor: "#e1dfdd", minHeight: 40 }}>
                  <span className="text-[13px] w-10 flex-shrink-0" style={{ color: "#605e5c" }}>Cc</span>
                  <input type="text" className="flex-1 text-[13px] py-2.5 outline-none bg-transparent" style={{ color: "#323130", fontFamily: "'Segoe UI', system-ui, sans-serif" }}
                    value={compose.ccAddress} onChange={e => setCompose(p => ({ ...p, ccAddress: e.target.value }))} autoFocus />
                  <button onClick={() => { setShowCc(false); setCompose(p => ({ ...p, ccAddress: "" })); }} style={{ color: "#605e5c" }}><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
              {showBcc && (
                <div className="flex items-center px-4 border-b flex-shrink-0" style={{ borderColor: "#e1dfdd", minHeight: 40 }}>
                  <span className="text-[13px] w-10 flex-shrink-0" style={{ color: "#605e5c" }}>Bcc</span>
                  <input type="text" className="flex-1 text-[13px] py-2.5 outline-none bg-transparent" style={{ color: "#323130", fontFamily: "'Segoe UI', system-ui, sans-serif" }}
                    value={compose.bccAddress} onChange={e => setCompose(p => ({ ...p, bccAddress: e.target.value }))} autoFocus />
                  <button onClick={() => { setShowBcc(false); setCompose(p => ({ ...p, bccAddress: "" })); }} style={{ color: "#605e5c" }}><X className="w-3.5 h-3.5" /></button>
                </div>
              )}

              {/* Subject */}
              <div className="flex items-center px-4 border-b flex-shrink-0" style={{ borderColor: "#e1dfdd", minHeight: 40 }}>
                <input
                  type="text"
                  className="w-full text-[15px] py-2.5 outline-none bg-transparent"
                  style={{ color: "#323130", fontFamily: "'Segoe UI', system-ui, sans-serif" }}
                  placeholder="Add a subject"
                  value={compose.subject}
                  onChange={e => setCompose(p => ({ ...p, subject: e.target.value }))}
                />
              </div>

              {/* Body */}
              <div className="flex-1 px-4 pt-3 overflow-hidden">
                <textarea
                  className="w-full h-full resize-none outline-none bg-transparent text-[13px]"
                  style={{ color: "#323130", fontFamily: "'Segoe UI', system-ui, sans-serif", lineHeight: 1.6 }}
                  placeholder="Write your message…"
                  value={compose.body}
                  onChange={e => setCompose(p => ({ ...p, body: e.target.value }))}
                />
              </div>

              {/* Attachment chips */}
              {attachments.length > 0 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5 border-t flex-shrink-0" style={{ borderColor: "#e1dfdd" }}>
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 rounded border px-2 py-1 text-[12px]"
                      style={{ borderColor: "#e1dfdd", color: "#323130" }}>
                      <FileIcon className="w-3.5 h-3.5" style={{ color: "#0078d4" }} />
                      <span className="truncate max-w-[140px]">{att.filename}</span>
                      <span style={{ color: "#605e5c" }}>{formatBytes(att.size)}</span>
                      <button onClick={() => removeAttachment(idx)} style={{ color: "#605e5c" }}><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          ) : selectedEmail ? (
            /* ── Reading pane ──────────────────────────────────────────────── */
            <div className="flex flex-col h-full">

              {/* Reading pane toolbar */}
              <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0" style={{ borderColor: "#e1dfdd" }}>
                {selectedEmail.folder !== "sent" && (
                  <button
                    onClick={() => handleReply(selectedEmail)}
                    className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded border transition-colors hover:bg-gray-50"
                    style={{ borderColor: "#e1dfdd", color: "#323130" }}
                  >
                    <Reply className="w-3.5 h-3.5" /> Reply
                  </button>
                )}
                <button
                  className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded border transition-colors hover:bg-gray-50"
                  style={{ borderColor: "#e1dfdd", color: "#323130" }}
                >
                  <Forward className="w-3.5 h-3.5" /> Forward
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => patchMutation.mutate({ id: selectedEmail.id, patch: { isStarred: !selectedEmail.isStarred } })}
                  className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                  style={{ color: selectedEmail.isStarred ? "#f97316" : "#605e5c" }}
                >
                  <Star className={`w-4 h-4 ${selectedEmail.isStarred ? "fill-orange-400" : ""}`} />
                </button>
                <button
                  onClick={() => patchMutation.mutate({ id: selectedEmail.id, patch: { isRead: !selectedEmail.isRead } })}
                  className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                  style={{ color: "#605e5c" }}
                  title={selectedEmail.isRead ? "Mark as unread" : "Mark as read"}
                >
                  {selectedEmail.isRead ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(selectedEmail.id)}
                  className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                  style={{ color: "#a4262c" }}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Subject */}
              <div className="px-5 pt-4 pb-2 flex-shrink-0">
                <h2 className="text-[20px] font-semibold" style={{ color: "#323130" }}>
                  {selectedEmail.subject || "(no subject)"}
                </h2>
              </div>

              {/* Sender info */}
              <div className="px-5 py-3 border-b flex-shrink-0" style={{ borderColor: "#e1dfdd" }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[15px] flex-shrink-0"
                      style={{ background: "#0078d4" }}
                    >
                      {avatarInitial(selectedEmail.fromName, selectedEmail.fromAddress)}
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold" style={{ color: "#323130" }}>
                        {selectedEmail.fromName ?? selectedEmail.fromAddress}
                      </div>
                      <div className="text-[12px]" style={{ color: "#605e5c" }}>
                        {selectedEmail.fromAddress}
                      </div>
                      <div className="text-[12px] mt-0.5" style={{ color: "#a19f9d" }}>
                        To: {selectedEmail.toAddress}
                        {selectedEmail.ccAddress && ` · Cc: ${selectedEmail.ccAddress}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[12px]" style={{ color: "#605e5c" }}>
                      {new Date(selectedEmail.createdAt).toLocaleString("en-AE", {
                        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Attachments on received email */}
              {selectedEmail.attachments && (selectedEmail.attachments as any[]).length > 0 && (
                <div className="px-5 py-2 border-b flex flex-wrap gap-2 flex-shrink-0" style={{ borderColor: "#e1dfdd", background: "#faf9f8" }}>
                  {(selectedEmail.attachments as any[]).map((att, i) => (
                    <a key={i}
                      href={att.content
                        ? `data:${att.contentType};base64,${att.content}`
                        : `${BASE}api/emails/${selectedEmail.id}/attachments/${i}`}
                      download={att.filename}
                      className="flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[12px] transition-colors hover:bg-blue-50"
                      style={{ borderColor: "#e1dfdd", color: "#323130", textDecoration: "none" }}
                    >
                      <Paperclip className="w-3 h-3" style={{ color: "#605e5c" }} />
                      <span className="truncate max-w-[140px]">{att.filename}</span>
                      <span style={{ color: "#a19f9d" }}>{formatBytes(att.size ?? 0)}</span>
                    </a>
                  ))}
                </div>
              )}

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <div className="text-[14px] whitespace-pre-line leading-relaxed" style={{ color: "#323130" }}>
                  {selectedEmail.body}
                </div>
              </div>

              {/* Quick reply */}
              <div className="border-t px-5 py-3 flex-shrink-0" style={{ borderColor: "#e1dfdd", background: "#faf9f8" }}>
                <button
                  onClick={() => handleReply(selectedEmail)}
                  className="flex items-center gap-2 w-full text-[13px] rounded border px-3 py-2 text-left transition-colors hover:bg-white"
                  style={{ borderColor: "#e1dfdd", color: "#605e5c" }}
                >
                  <Reply className="w-3.5 h-3.5" />
                  Reply to {selectedEmail.fromName ?? selectedEmail.fromAddress}…
                </button>
              </div>
            </div>

          ) : (
            /* ── Empty state — Outlook style ───────────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <OutlookEnvelope />
              <div className="text-center">
                <p className="text-[16px] font-semibold" style={{ color: "#323130" }}>
                  Select an item to read
                </p>
                <p className="text-[13px] mt-1" style={{ color: "#605e5c" }}>
                  Nothing is selected
                </p>
              </div>
              {!isConnected && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="mt-2 flex items-center gap-2 text-[13px] px-4 py-2 rounded text-white"
                  style={{ background: "#0078d4" }}
                >
                  <Mail className="w-4 h-4" /> Connect Email Account
                </button>
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
