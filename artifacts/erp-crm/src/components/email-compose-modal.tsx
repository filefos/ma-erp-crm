import { useState, useEffect, useRef, useCallback } from "react";
import { useEmailCompose, type EmailAttachment } from "@/contexts/email-compose-context";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  X, Minus, Maximize2, Minimize2, Send, Paperclip, FileText,
  Search, ChevronDown, ChevronUp, Loader2, FileIcon, Trash2,
  Mail, Receipt, Package, ClipboardList, FileCheck, BookOpen, FolderOpen,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;
const MAX_MB = 10;

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
    const txt = await res.text();
    let msg = txt;
    try { msg = JSON.parse(txt).error ?? txt; } catch { /* keep */ }
    throw new Error(msg);
  }
  return res.json();
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type WindowState = "normal" | "minimized" | "maximized";
type ExplorerTab = "quotations" | "proforma" | "invoices" | "delivery_notes" | "undertaking" | "handover" | "lpos";

interface DocResult {
  id: number;
  label: string;
  sub: string;
  amount?: string;
  status?: string;
  clientName?: string;
  clientEmail?: string;
}

interface ExplorerResults {
  quotations: DocResult[];
  proforma: DocResult[];
  invoices: DocResult[];
  delivery_notes: DocResult[];
  undertaking: DocResult[];
  handover: DocResult[];
  lpos: DocResult[];
}

const EXPLORER_TABS: { key: ExplorerTab; label: string; icon: React.ReactNode; apiPath: string }[] = [
  { key: "quotations", label: "Quotations", icon: <FileText className="w-3.5 h-3.5" />, apiPath: "/quotations" },
  { key: "proforma", label: "Proforma", icon: <Receipt className="w-3.5 h-3.5" />, apiPath: "/proforma-invoices" },
  { key: "invoices", label: "Tax Invoices", icon: <FileCheck className="w-3.5 h-3.5" />, apiPath: "/tax-invoices" },
  { key: "delivery_notes", label: "Delivery Notes", icon: <Package className="w-3.5 h-3.5" />, apiPath: "/delivery-notes" },
  { key: "undertaking", label: "Undertaking", icon: <BookOpen className="w-3.5 h-3.5" />, apiPath: "/undertaking-letters" },
  { key: "handover", label: "Handover", icon: <ClipboardList className="w-3.5 h-3.5" />, apiPath: "/handover-notes" },
  { key: "lpos", label: "LPOs", icon: <FolderOpen className="w-3.5 h-3.5" />, apiPath: "/lpos" },
];

function mapResults(tab: ExplorerTab, rows: any[]): DocResult[] {
  return rows.map((r: any) => {
    switch (tab) {
      case "quotations":
        return { id: r.id, label: r.quotationNumber ?? `QTN-${r.id}`, sub: r.projectName ?? r.clientName ?? "", amount: r.grandTotal ? `AED ${Number(r.grandTotal).toLocaleString()}` : undefined, status: r.status, clientName: r.clientName, clientEmail: r.clientEmail };
      case "proforma":
        return { id: r.id, label: r.piNumber ?? `PI-${r.id}`, sub: r.projectName ?? r.clientName ?? "", amount: r.total ? `AED ${Number(r.total).toLocaleString()}` : undefined, status: r.status, clientName: r.clientName, clientEmail: r.clientEmail };
      case "invoices":
        return { id: r.id, label: r.invoiceNumber ?? `INV-${r.id}`, sub: r.clientName ?? "", amount: r.grandTotal ? `AED ${Number(r.grandTotal).toLocaleString()}` : undefined, status: r.paymentStatus, clientName: r.clientName, clientEmail: r.clientEmail };
      case "delivery_notes":
        return { id: r.id, label: r.dnNumber ?? `DN-${r.id}`, sub: r.projectName ?? r.clientName ?? "", status: r.status, clientName: r.clientName, clientEmail: r.clientEmail };
      case "undertaking":
        return { id: r.id, label: r.ulNumber ?? `UL-${r.id}`, sub: r.clientName ?? "", status: r.status, clientName: r.clientName };
      case "handover":
        return { id: r.id, label: r.honNumber ?? `HON-${r.id}`, sub: r.clientName ?? "", status: r.status, clientName: r.clientName };
      case "lpos":
        return { id: r.id, label: r.lpoNumber ?? `LPO-${r.id}`, sub: r.projectName ?? r.clientName ?? "", amount: r.lpoValue ? `AED ${Number(r.lpoValue).toLocaleString()}` : undefined, status: r.status, clientName: r.clientName };
      default:
        return { id: r.id, label: `#${r.id}`, sub: "" };
    }
  });
}

function generateDocRef(tab: ExplorerTab, doc: DocResult): string {
  const typeLabel: Record<ExplorerTab, string> = {
    quotations: "Quotation", proforma: "Proforma Invoice", invoices: "Tax Invoice",
    delivery_notes: "Delivery Note", undertaking: "Undertaking Letter",
    handover: "Handover Note", lpos: "Client LPO",
  };
  const lines = [
    `【${typeLabel[tab]}】`,
    `Reference: ${doc.label}`,
    doc.clientName ? `Client: ${doc.clientName}` : "",
    doc.sub && doc.sub !== doc.clientName ? `Project: ${doc.sub}` : "",
    doc.amount ? `Amount: ${doc.amount}` : "",
    doc.status ? `Status: ${doc.status}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

function generateDocAttachment(tab: ExplorerTab, doc: DocResult): EmailAttachment {
  const typeLabel: Record<ExplorerTab, string> = {
    quotations: "Quotation", proforma: "Proforma Invoice", invoices: "Tax Invoice",
    delivery_notes: "Delivery Note", undertaking: "Undertaking Letter",
    handover: "Handover Note", lpos: "Client LPO",
  };
  const content = generateDocRef(tab, doc);
  const base64 = btoa(unescape(encodeURIComponent(content)));
  return {
    filename: `${typeLabel[tab].replace(/ /g, "-")}-${doc.label}.txt`,
    content: base64,
    contentType: "text/plain",
    size: content.length,
  };
}

export function EmailComposeModal() {
  const { isOpen, options, closeCompose } = useEmailCompose();
  const { user } = useAuth();
  const { toast } = useToast();

  const [windowState, setWindowState] = useState<WindowState>("normal");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [explorerTab, setExplorerTab] = useState<ExplorerTab>("quotations");
  const [explorerSearch, setExplorerSearch] = useState("");
  const [explorerResults, setExplorerResults] = useState<ExplorerResults>({
    quotations: [], proforma: [], invoices: [], delivery_notes: [], undertaking: [], handover: [], lpos: [],
  });
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [attachedDocIds, setAttachedDocIds] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    toAddress: "", toName: "", ccAddress: "", bccAddress: "", subject: "", body: "",
  });
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const dropZoneRef = useRef<HTMLDivElement>(null);
  const explorerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setWindowState("normal");
      setShowCc(!!options.ccAddress);
      setShowBcc(false);
      setShowExplorer(false);
      setExplorerSearch("");
      setAttachedDocIds(new Set());
      setForm({
        toAddress: options.toAddress ?? "",
        toName: options.toName ?? "",
        ccAddress: options.ccAddress ?? "",
        bccAddress: "",
        subject: options.subject ?? "",
        body: options.body ?? "",
      });
      setAttachments(options.attachments ?? []);
    }
  }, [isOpen, options]);

  const searchExplorer = useCallback(async (q: string) => {
    if (q.length < 2) {
      setExplorerResults({ quotations: [], proforma: [], invoices: [], delivery_notes: [], undertaking: [], handover: [], lpos: [] });
      return;
    }
    setExplorerLoading(true);
    try {
      const tabs = EXPLORER_TABS;
      const results = await Promise.allSettled(
        tabs.map(t => apiFetch(`${t.apiPath}?search=${encodeURIComponent(q)}`))
      );
      const newResults: ExplorerResults = { quotations: [], proforma: [], invoices: [], delivery_notes: [], undertaking: [], handover: [], lpos: [] };
      tabs.forEach((t, i) => {
        const res = results[i];
        if (res.status === "fulfilled") {
          const rows = Array.isArray(res.value) ? res.value : (res.value?.data ?? []);
          newResults[t.key] = mapResults(t.key, rows.slice(0, 10));
        }
      });
      setExplorerResults(newResults);
    } catch {
      // silently fail
    } finally {
      setExplorerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (explorerSearchTimer.current) clearTimeout(explorerSearchTimer.current);
    explorerSearchTimer.current = setTimeout(() => searchExplorer(explorerSearch), 400);
    return () => { if (explorerSearchTimer.current) clearTimeout(explorerSearchTimer.current); };
  }, [explorerSearch, searchExplorer]);

  const addFileAttachment = async (file: File) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      toast({ title: `File too large (max ${MAX_MB} MB)`, variant: "destructive" });
      return;
    }
    const content = await toBase64(file);
    setAttachments(prev => [...prev, { filename: file.name, content, contentType: file.type || "application/octet-stream", size: file.size }]);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) await addFileAttachment(f);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const f of files) await addFileAttachment(f);
  };

  const attachDoc = (tab: ExplorerTab, doc: DocResult) => {
    const key = `${tab}-${doc.id}`;
    if (attachedDocIds.has(key)) return;
    setAttachedDocIds(prev => new Set([...prev, key]));
    const att = generateDocAttachment(tab, doc);
    setAttachments(prev => [...prev, att]);
    const ref = generateDocRef(tab, doc);
    setForm(prev => ({
      ...prev,
      body: prev.body ? `${prev.body}\n\n---\n${ref}` : ref,
      toAddress: prev.toAddress || doc.clientEmail || "",
      toName: prev.toName || doc.clientName || "",
    }));
    toast({ title: "Document reference attached", description: doc.label });
  };

  const removeAttachment = (i: number) => {
    setAttachments(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSend = async () => {
    if (!form.toAddress.trim()) { toast({ title: "Recipient required", variant: "destructive" }); return; }
    if (!form.subject.trim()) { toast({ title: "Subject required", variant: "destructive" }); return; }
    setSending(true);
    try {
      const companyId = options.companyId ?? (user as any)?.companyId ?? null;
      await apiFetch("/emails", {
        method: "POST",
        body: JSON.stringify({
          action: "send",
          companyId,
          toAddress: form.toAddress,
          toName: form.toName || undefined,
          ccAddress: form.ccAddress || undefined,
          bccAddress: form.bccAddress || undefined,
          subject: form.subject,
          body: form.body,
          folder: "sent",
          attachments: attachments.map(a => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
        }),
      });
      toast({ title: "Email sent successfully!", description: `To: ${form.toAddress}` });
      closeCompose();
    } catch (err: any) {
      toast({ title: "Failed to send email", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      const companyId = options.companyId ?? (user as any)?.companyId ?? null;
      await apiFetch("/emails", {
        method: "POST",
        body: JSON.stringify({
          action: "draft",
          companyId,
          toAddress: form.toAddress || "draft@draft",
          toName: form.toName || undefined,
          ccAddress: form.ccAddress || undefined,
          subject: form.subject || "(No Subject)",
          body: form.body,
          folder: "draft",
        }),
      });
      toast({ title: "Draft saved" });
      closeCompose();
    } catch {
      toast({ title: "Failed to save draft", variant: "destructive" });
    }
  };

  if (!isOpen) return null;

  const currentTabResults = explorerResults[explorerTab];
  const totalResults = Object.values(explorerResults).reduce((s, a) => s + a.length, 0);

  if (windowState === "minimized") {
    return (
      <div className="fixed bottom-0 right-6 z-50 flex items-center gap-2 bg-[#0f2d5a] text-white rounded-t-lg px-4 h-10 shadow-2xl cursor-pointer min-w-[260px] max-w-[360px]"
        onClick={() => setWindowState("normal")}>
        <Mail className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium truncate flex-1">{form.subject || "New Email"}</span>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button className="hover:bg-white/20 rounded p-1" onClick={() => setWindowState("normal")}><ChevronUp className="w-3.5 h-3.5" /></button>
          <button className="hover:bg-white/20 rounded p-1" onClick={closeCompose}><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    );
  }

  const isMaximized = windowState === "maximized";

  return (
    <div className={`fixed z-50 shadow-2xl rounded-xl overflow-hidden flex flex-col bg-white border border-gray-200
      ${isMaximized
        ? "inset-4"
        : "bottom-0 right-6 w-[640px]"
      }`}
      style={isMaximized ? {} : { height: showExplorer ? 580 : 520 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 bg-[#0f2d5a] text-white px-4 py-2.5 shrink-0 select-none">
        <Mail className="w-4 h-4 shrink-0" />
        <span className="text-sm font-semibold flex-1 truncate">{form.subject || "New Message"}</span>
        <div className="flex items-center gap-1">
          <button
            title="Toggle Document Explorer"
            className={`rounded p-1 transition-colors ${showExplorer ? "bg-white/30" : "hover:bg-white/20"}`}
            onClick={() => setShowExplorer(s => !s)}
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          <button className="hover:bg-white/20 rounded p-1" onClick={() => setWindowState("minimized")}><Minus className="w-3.5 h-3.5" /></button>
          <button className="hover:bg-white/20 rounded p-1" onClick={() => setWindowState(s => s === "maximized" ? "normal" : "maximized")}>
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button className="hover:bg-red-500/80 rounded p-1" onClick={closeCompose}><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Compose area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Fields */}
          <div className="border-b border-gray-100 divide-y divide-gray-100">
            {/* To */}
            <div className="flex items-center px-3 py-1.5 gap-2">
              <span className="text-xs text-muted-foreground w-7 shrink-0">To</span>
              <Input
                value={form.toAddress}
                onChange={e => setForm(p => ({ ...p, toAddress: e.target.value }))}
                placeholder="recipient@example.com"
                className="border-0 shadow-none focus-visible:ring-0 h-7 text-sm px-0 flex-1"
              />
              <div className="flex gap-1">
                {!showCc && <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowCc(true)}>CC</button>}
                {!showBcc && <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowBcc(true)}>BCC</button>}
              </div>
            </div>

            {/* CC */}
            {showCc && (
              <div className="flex items-center px-3 py-1.5 gap-2">
                <span className="text-xs text-muted-foreground w-7 shrink-0">CC</span>
                <Input
                  value={form.ccAddress}
                  onChange={e => setForm(p => ({ ...p, ccAddress: e.target.value }))}
                  placeholder="cc@example.com"
                  className="border-0 shadow-none focus-visible:ring-0 h-7 text-sm px-0 flex-1"
                />
                <button className="text-muted-foreground hover:text-foreground" onClick={() => { setShowCc(false); setForm(p => ({ ...p, ccAddress: "" })); }}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* BCC */}
            {showBcc && (
              <div className="flex items-center px-3 py-1.5 gap-2">
                <span className="text-xs text-muted-foreground w-7 shrink-0">BCC</span>
                <Input
                  value={form.bccAddress}
                  onChange={e => setForm(p => ({ ...p, bccAddress: e.target.value }))}
                  placeholder="bcc@example.com"
                  className="border-0 shadow-none focus-visible:ring-0 h-7 text-sm px-0 flex-1"
                />
                <button className="text-muted-foreground hover:text-foreground" onClick={() => { setShowBcc(false); setForm(p => ({ ...p, bccAddress: "" })); }}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Subject */}
            <div className="flex items-center px-3 py-1.5 gap-2">
              <span className="text-xs text-muted-foreground w-7 shrink-0">Sub</span>
              <Input
                value={form.subject}
                onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="Subject"
                className="border-0 shadow-none focus-visible:ring-0 h-7 text-sm px-0 flex-1"
              />
            </div>
          </div>

          {/* Body */}
          <Textarea
            value={form.body}
            onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
            placeholder="Write your message here…"
            className="flex-1 border-0 shadow-none focus-visible:ring-0 rounded-none resize-none text-sm px-3 py-2 min-h-0"
          />

          {/* Attachments list */}
          {attachments.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-100 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-xs max-w-[180px]">
                  <FileIcon className="w-3 h-3 text-[#0f2d5a] shrink-0" />
                  <span className="truncate flex-1">{a.filename}</span>
                  <span className="text-muted-foreground shrink-0">{formatBytes(a.size)}</span>
                  <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-red-500 shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Drop zone */}
          <div
            ref={dropZoneRef}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`mx-3 mb-2 mt-1 border-2 border-dashed rounded-lg py-2 text-center text-xs text-muted-foreground transition-colors cursor-default
              ${isDragOver ? "border-[#1e6ab0] bg-blue-50 text-[#1e6ab0]" : "border-gray-200"}`}
          >
            Drop files here or use the paperclip button below
          </div>

          {/* Footer bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50 shrink-0">
            <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0] gap-1.5" onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {sending ? "Sending…" : "Send"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleSaveDraft}>Save Draft</Button>
            <label className="cursor-pointer">
              <input type="file" multiple className="hidden" onChange={handleFileInput} />
              <span className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs rounded px-2 py-1 hover:bg-gray-200 transition-colors">
                <Paperclip className="w-3.5 h-3.5" />Attach
              </span>
            </label>
            <span className="text-xs text-muted-foreground ml-auto">
              {attachments.length > 0 && `${attachments.length} file${attachments.length > 1 ? "s" : ""}`}
            </span>
          </div>
        </div>

        {/* Client Document Explorer */}
        {showExplorer && (
          <div className="w-64 border-l border-gray-200 flex flex-col bg-gray-50 shrink-0">
            <div className="px-3 py-2 border-b border-gray-200 bg-white">
              <p className="text-xs font-semibold text-[#0f2d5a] mb-1.5">Client Document Explorer</p>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  value={explorerSearch}
                  onChange={e => setExplorerSearch(e.target.value)}
                  placeholder="Search client or ref…"
                  className="h-7 text-xs pl-6"
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-gray-200 bg-white shrink-0">
              {EXPLORER_TABS.map(t => {
                const count = explorerResults[t.key].length;
                return (
                  <button
                    key={t.key}
                    onClick={() => setExplorerTab(t.key)}
                    className={`flex items-center gap-1 px-2 py-1.5 text-[10px] whitespace-nowrap border-b-2 transition-colors shrink-0
                      ${explorerTab === t.key ? "border-[#0f2d5a] text-[#0f2d5a] font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    {t.icon}
                    {t.label}
                    {count > 0 && <Badge className="bg-[#0f2d5a] text-white text-[9px] h-3.5 px-1 ml-0.5">{count}</Badge>}
                  </button>
                );
              })}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {explorerSearch.length < 2 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-3 py-8 gap-2">
                  <Search className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Type a client name or document reference to find documents</p>
                </div>
              ) : explorerLoading ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : currentTabResults.length === 0 ? (
                <div className="text-center py-8 px-3">
                  <p className="text-xs text-muted-foreground">No {EXPLORER_TABS.find(t => t.key === explorerTab)?.label.toLowerCase()} found</p>
                  {totalResults > 0 && <p className="text-[10px] text-muted-foreground mt-1">Try another tab — {totalResults} result{totalResults !== 1 ? "s" : ""} in other categories</p>}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {currentTabResults.map(doc => {
                    const key = `${explorerTab}-${doc.id}`;
                    const isAttached = attachedDocIds.has(key);
                    return (
                      <div key={doc.id} className="px-3 py-2 hover:bg-white transition-colors">
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate text-[#0f2d5a]">{doc.label}</p>
                            {doc.sub && <p className="text-[10px] text-muted-foreground truncate">{doc.sub}</p>}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {doc.amount && <span className="text-[10px] text-green-700 font-medium">{doc.amount}</span>}
                              {doc.status && <Badge className={`text-[9px] h-3.5 px-1 ${doc.status === "approved" || doc.status === "paid" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{doc.status}</Badge>}
                            </div>
                          </div>
                          <button
                            onClick={() => attachDoc(explorerTab, doc)}
                            disabled={isAttached}
                            title={isAttached ? "Already attached" : "Attach to email"}
                            className={`shrink-0 rounded p-1 text-[10px] transition-colors mt-0.5
                              ${isAttached ? "text-green-600 bg-green-50" : "text-[#0f2d5a] hover:bg-[#0f2d5a] hover:text-white"}`}
                          >
                            {isAttached ? <FileCheck className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-3 py-2 border-t border-gray-200 bg-white">
              <p className="text-[10px] text-muted-foreground">Click <Paperclip className="w-2.5 h-2.5 inline" /> to attach document reference to email</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
