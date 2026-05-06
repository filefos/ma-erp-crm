import { useState, useEffect, useRef, useCallback } from "react";
import { useEmailCompose, type EmailAttachment } from "@/contexts/email-compose-context";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Minus, Maximize2, Minimize2, X, ChevronDown, Loader2,
  Paperclip, FileText, Search, FileCheck, Package, Receipt,
  BookOpen, ClipboardList, FolderOpen, FileIcon, Bold, Italic,
  Underline, Link, Smile, Image, AlertCircle, Trash2, Copy,
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

const EXPLORER_TABS: { key: ExplorerTab; label: string; apiPath: string }[] = [
  { key: "quotations",     label: "Quotations",      apiPath: "/quotations" },
  { key: "proforma",       label: "Proforma",         apiPath: "/proforma-invoices" },
  { key: "invoices",       label: "Tax Invoices",     apiPath: "/tax-invoices" },
  { key: "delivery_notes", label: "Delivery Notes",   apiPath: "/delivery-notes" },
  { key: "undertaking",    label: "Undertaking",      apiPath: "/undertaking-letters" },
  { key: "handover",       label: "Handover",         apiPath: "/handover-notes" },
  { key: "lpos",           label: "LPOs",             apiPath: "/lpos" },
];

function mapResults(tab: ExplorerTab, rows: any[]): DocResult[] {
  return rows.map((r: any) => {
    switch (tab) {
      case "quotations":     return { id: r.id, label: r.quotationNumber ?? `QTN-${r.id}`, sub: r.projectName ?? r.clientName ?? "", amount: r.grandTotal ? `AED ${Number(r.grandTotal).toLocaleString()}` : undefined, status: r.status, clientName: r.clientName, clientEmail: r.clientEmail };
      case "proforma":       return { id: r.id, label: r.piNumber ?? `PI-${r.id}`, sub: r.projectName ?? r.clientName ?? "", amount: r.total ? `AED ${Number(r.total).toLocaleString()}` : undefined, status: r.status, clientName: r.clientName, clientEmail: r.clientEmail };
      case "invoices":       return { id: r.id, label: r.invoiceNumber ?? `INV-${r.id}`, sub: r.clientName ?? "", amount: r.grandTotal ? `AED ${Number(r.grandTotal).toLocaleString()}` : undefined, status: r.paymentStatus, clientName: r.clientName, clientEmail: r.clientEmail };
      case "delivery_notes": return { id: r.id, label: r.dnNumber ?? `DN-${r.id}`, sub: r.projectName ?? r.clientName ?? "", status: r.status, clientName: r.clientName, clientEmail: r.clientEmail };
      case "undertaking":    return { id: r.id, label: r.ulNumber ?? `UL-${r.id}`, sub: r.clientName ?? "", status: r.status, clientName: r.clientName };
      case "handover":       return { id: r.id, label: r.honNumber ?? `HON-${r.id}`, sub: r.clientName ?? "", status: r.status, clientName: r.clientName };
      case "lpos":           return { id: r.id, label: r.lpoNumber ?? `LPO-${r.id}`, sub: r.projectName ?? r.clientName ?? "", amount: r.lpoValue ? `AED ${Number(r.lpoValue).toLocaleString()}` : undefined, status: r.status, clientName: r.clientName };
      default:               return { id: r.id, label: `#${r.id}`, sub: "" };
    }
  });
}

function generateDocRef(tab: ExplorerTab, doc: DocResult): string {
  const typeLabel: Record<ExplorerTab, string> = {
    quotations: "Quotation", proforma: "Proforma Invoice", invoices: "Tax Invoice",
    delivery_notes: "Delivery Note", undertaking: "Undertaking Letter",
    handover: "Handover Note", lpos: "Client LPO",
  };
  return [
    `【${typeLabel[tab]}】`,
    `Reference: ${doc.label}`,
    doc.clientName ? `Client: ${doc.clientName}` : "",
    doc.sub && doc.sub !== doc.clientName ? `Project: ${doc.sub}` : "",
    doc.amount ? `Amount: ${doc.amount}` : "",
    doc.status ? `Status: ${doc.status}` : "",
  ].filter(Boolean).join("\n");
}

function generateDocAttachment(tab: ExplorerTab, doc: DocResult): EmailAttachment {
  const typeLabel: Record<ExplorerTab, string> = {
    quotations: "Quotation", proforma: "Proforma-Invoice", invoices: "Tax-Invoice",
    delivery_notes: "Delivery-Note", undertaking: "Undertaking-Letter",
    handover: "Handover-Note", lpos: "Client-LPO",
  };
  const content = generateDocRef(tab, doc);
  const base64 = btoa(unescape(encodeURIComponent(content)));
  return { filename: `${typeLabel[tab]}-${doc.label}.txt`, content: base64, contentType: "text/plain", size: content.length };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Ribbon button                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */
function RibbonBtn({ icon, label, active, onClick, className = "" }: {
  icon: React.ReactNode; label?: string; active?: boolean; onClick?: () => void; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded text-[#444] hover:bg-[#e8e8e8] transition-colors min-w-[36px]
        ${active ? "bg-[#d0e6f8] text-[#0078d4]" : ""} ${className}`}
    >
      <span className="text-[15px] leading-none">{icon}</span>
      {label && <span className="text-[9px] leading-tight whitespace-nowrap">{label}</span>}
    </button>
  );
}

function RibbonDivider() {
  return <div className="w-px h-8 bg-[#e0e0e0] mx-1 self-center" />;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Main component                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */
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

  const [form, setForm] = useState({ toAddress: "", toName: "", ccAddress: "", bccAddress: "", subject: "", body: "" });
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const explorerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const settled = await Promise.allSettled(
        EXPLORER_TABS.map(t => apiFetch(`${t.apiPath}?search=${encodeURIComponent(q)}`))
      );
      const next: ExplorerResults = { quotations: [], proforma: [], invoices: [], delivery_notes: [], undertaking: [], handover: [], lpos: [] };
      EXPLORER_TABS.forEach((t, i) => {
        const r = settled[i];
        if (r.status === "fulfilled") {
          const rows = Array.isArray(r.value) ? r.value : (r.value?.data ?? []);
          next[t.key] = mapResults(t.key, rows.slice(0, 12));
        }
      });
      setExplorerResults(next);
    } finally {
      setExplorerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (explorerTimer.current) clearTimeout(explorerTimer.current);
    explorerTimer.current = setTimeout(() => searchExplorer(explorerSearch), 380);
    return () => { if (explorerTimer.current) clearTimeout(explorerTimer.current); };
  }, [explorerSearch, searchExplorer]);

  const addFile = async (file: File) => {
    if (file.size > MAX_MB * 1048576) { toast({ title: `Max ${MAX_MB} MB per file`, variant: "destructive" }); return; }
    const content = await toBase64(file);
    setAttachments(prev => [...prev, { filename: file.name, content, contentType: file.type || "application/octet-stream", size: file.size }]);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    for (const f of Array.from(e.dataTransfer.files)) await addFile(f);
  };

  const attachDoc = (tab: ExplorerTab, doc: DocResult) => {
    const key = `${tab}-${doc.id}`;
    if (attachedDocIds.has(key)) return;
    setAttachedDocIds(prev => new Set([...prev, key]));
    setAttachments(prev => [...prev, generateDocAttachment(tab, doc)]);
    const ref = generateDocRef(tab, doc);
    setForm(prev => ({
      ...prev,
      body: prev.body ? `${prev.body}\n\n---\n${ref}` : ref,
      toAddress: prev.toAddress || doc.clientEmail || "",
      toName: prev.toName || doc.clientName || "",
    }));
    toast({ title: "Document attached", description: doc.label });
  };

  const handleSend = async () => {
    if (!form.toAddress.trim()) { toast({ title: "Please fill in the To field", variant: "destructive" }); return; }
    if (!form.subject.trim()) { toast({ title: "Please add a subject", variant: "destructive" }); return; }
    setSending(true);
    try {
      await apiFetch("/emails", {
        method: "POST",
        body: JSON.stringify({
          action: "send",
          companyId: options.companyId ?? (user as any)?.companyId ?? null,
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
      toast({ title: "Email sent", description: `To: ${form.toAddress}` });
      closeCompose();
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleDraft = async () => {
    try {
      await apiFetch("/emails", {
        method: "POST",
        body: JSON.stringify({
          action: "draft",
          companyId: options.companyId ?? (user as any)?.companyId ?? null,
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
      toast({ title: "Could not save draft", variant: "destructive" });
    }
  };

  if (!isOpen) return null;

  /* ── Minimized tab ──────────────────────────────────────────────────────── */
  if (windowState === "minimized") {
    return (
      <div
        className="fixed bottom-0 right-6 z-50 flex items-center gap-2 bg-[#f3f2f1] border border-b-0 border-[#c8c6c4] rounded-t-md shadow-lg px-3 h-9 cursor-pointer select-none"
        style={{ minWidth: 280 }}
        onClick={() => setWindowState("normal")}
      >
        <span className="text-[13px] text-[#323130] truncate flex-1 font-medium">{form.subject || "New Email"}</span>
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <button className="p-1 rounded hover:bg-[#e1dfdd] text-[#605e5c]" onClick={() => setWindowState("normal")} title="Restore">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 rounded hover:bg-[#e1dfdd] text-[#605e5c]" onClick={closeCompose} title="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const isMaximized = windowState === "maximized";
  const totalDocResults = Object.values(explorerResults).reduce((s, a) => s + a.length, 0);
  const currentTabResults = explorerResults[explorerTab];

  const fromAddress = (() => {
    const u = user as any;
    return u?.email ?? u?.username ?? "you@primemaxprefab.com";
  })();

  /* ── Full window ─────────────────────────────────────────────────────────── */
  return (
    <div
      className={`fixed z-50 flex flex-col bg-white border border-[#c8c6c4] shadow-2xl overflow-hidden
        ${isMaximized ? "inset-4 rounded-lg" : "bottom-0 right-6 rounded-t-lg"}`}
      style={isMaximized ? {} : { width: showExplorer ? 900 : 680, height: 560 }}
    >
      {/* ── Title bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center bg-[#f3f2f1] border-b border-[#e1dfdd] px-2 h-8 shrink-0 select-none">
        <span className="text-[12px] text-[#323130] truncate flex-1 pl-1">{form.subject || "New Email"}</span>
        <div className="flex items-center">
          <button
            className="w-8 h-8 flex items-center justify-center text-[#605e5c] hover:bg-[#e1dfdd] transition-colors"
            onClick={() => setWindowState("minimized")} title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center text-[#605e5c] hover:bg-[#e1dfdd] transition-colors"
            onClick={() => setWindowState(s => s === "maximized" ? "normal" : "maximized")}
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center text-[#605e5c] hover:bg-[#c42b1c] hover:text-white transition-colors"
            onClick={closeCompose} title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Ribbon ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center bg-white border-b border-[#e1dfdd] px-2 py-0.5 shrink-0 gap-0.5">
        {/* Attach File */}
        <label className="cursor-pointer">
          <input type="file" multiple className="hidden"
            onChange={async e => { for (const f of Array.from(e.target.files ?? [])) await addFile(f); e.target.value = ""; }} />
          <span className="flex flex-col items-center gap-0.5 px-2 py-1 rounded text-[#444] hover:bg-[#e8e8e8] min-w-[48px] cursor-pointer">
            <Paperclip className="w-4 h-4" />
            <span className="text-[9px] whitespace-nowrap">Attach File</span>
          </span>
        </label>
        <RibbonBtn icon={<Image className="w-4 h-4" />} label="Pictures" />
        <RibbonBtn icon={<Smile className="w-4 h-4" />} label="Emoji" />
        <RibbonBtn icon={<Link className="w-4 h-4" />} label="Link" />

        <RibbonDivider />

        <RibbonBtn icon={<Bold className="w-4 h-4" />} label="Bold" />
        <RibbonBtn icon={<Italic className="w-4 h-4" />} label="Italic" />
        <RibbonBtn icon={<Underline className="w-4 h-4" />} label="Underline" />

        <RibbonDivider />

        <RibbonBtn icon={<AlertCircle className="w-4 h-4 text-red-500" />} label="High" />

        <RibbonDivider />

        {/* Client Document Explorer toggle */}
        <RibbonBtn
          icon={<FolderOpen className="w-4 h-4" />}
          label="Client Docs"
          active={showExplorer}
          onClick={() => setShowExplorer(s => !s)}
        />

        <RibbonDivider />

        {/* Save Draft */}
        <RibbonBtn icon={<FileText className="w-4 h-4" />} label="Save Draft" onClick={handleDraft} />
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left: Compose area ─────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* ── Action row: Send + From ─────────────────────────────────── */}
          <div className="flex items-center px-4 py-2 gap-3 border-b border-[#e1dfdd] shrink-0">
            {/* Send button — Outlook blue pill */}
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center rounded overflow-hidden shadow-sm focus:outline-none"
              style={{ border: "1px solid #005a9e" }}
            >
              <span className="flex items-center gap-1.5 bg-[#0078d4] hover:bg-[#106ebe] active:bg-[#005a9e] text-white px-3.5 py-1.5 text-[13px] font-semibold transition-colors">
                {sending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2l14 6-14 6V9.5l10-1.5-10-1.5V2z"/></svg>
                }
                {sending ? "Sending…" : "Send"}
              </span>
              <span className="bg-[#0078d4] hover:bg-[#106ebe] active:bg-[#005a9e] text-white px-2 py-1.5 border-l border-white/30 transition-colors">
                <ChevronDown className="w-3 h-3" />
              </span>
            </button>

            {/* From */}
            <div className="flex items-center gap-1 text-[13px] text-[#323130]">
              <span className="text-[#605e5c]">From:</span>
              <button className="flex items-center gap-1 hover:text-[#0078d4] font-medium">
                {fromAddress}
                <ChevronDown className="w-3 h-3 text-[#605e5c]" />
              </button>
            </div>

            {/* Right-side icons */}
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={closeCompose}
                className="p-1.5 rounded text-[#605e5c] hover:bg-[#f3f2f1] hover:text-[#323130] transition-colors"
                title="Discard"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                className="p-1.5 rounded text-[#605e5c] hover:bg-[#f3f2f1] hover:text-[#323130] transition-colors"
                title="Pop out"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── To field ─────────────────────────────────────────────────── */}
          <div className="flex items-center px-4 border-b border-[#e1dfdd] shrink-0" style={{ minHeight: 38 }}>
            <span className="text-[13px] text-[#605e5c] w-10 shrink-0 font-normal">To</span>
            <input
              type="text"
              value={form.toAddress}
              onChange={e => setForm(p => ({ ...p, toAddress: e.target.value }))}
              placeholder=""
              className="flex-1 text-[13px] text-[#323130] bg-transparent border-0 outline-none py-2"
              style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
            />
            <div className="flex items-center gap-3 shrink-0">
              {!showCc && (
                <button
                  className="text-[13px] text-[#0078d4] hover:text-[#005a9e] font-normal"
                  onClick={() => setShowCc(true)}
                >Cc</button>
              )}
              {!showBcc && (
                <button
                  className="text-[13px] text-[#0078d4] hover:text-[#005a9e] font-normal"
                  onClick={() => setShowBcc(true)}
                >Bcc</button>
              )}
            </div>
          </div>

          {/* ── Cc field ─────────────────────────────────────────────────── */}
          {showCc && (
            <div className="flex items-center px-4 border-b border-[#e1dfdd] shrink-0" style={{ minHeight: 38 }}>
              <span className="text-[13px] text-[#605e5c] w-10 shrink-0">Cc</span>
              <input
                type="text"
                value={form.ccAddress}
                onChange={e => setForm(p => ({ ...p, ccAddress: e.target.value }))}
                className="flex-1 text-[13px] text-[#323130] bg-transparent border-0 outline-none py-2"
                style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
              />
              <button className="text-[11px] text-[#605e5c] hover:text-[#323130]" onClick={() => { setShowCc(false); setForm(p => ({ ...p, ccAddress: "" })); }}>
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* ── Bcc field ────────────────────────────────────────────────── */}
          {showBcc && (
            <div className="flex items-center px-4 border-b border-[#e1dfdd] shrink-0" style={{ minHeight: 38 }}>
              <span className="text-[13px] text-[#605e5c] w-10 shrink-0">Bcc</span>
              <input
                type="text"
                value={form.bccAddress}
                onChange={e => setForm(p => ({ ...p, bccAddress: e.target.value }))}
                className="flex-1 text-[13px] text-[#323130] bg-transparent border-0 outline-none py-2"
                style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
              />
              <button className="text-[11px] text-[#605e5c] hover:text-[#323130]" onClick={() => { setShowBcc(false); setForm(p => ({ ...p, bccAddress: "" })); }}>
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* ── Subject ──────────────────────────────────────────────────── */}
          <div className="flex items-center px-4 border-b border-[#e1dfdd] shrink-0" style={{ minHeight: 38 }}>
            <input
              type="text"
              value={form.subject}
              onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
              placeholder="Add a subject"
              className="flex-1 text-[15px] text-[#323130] bg-transparent border-0 outline-none py-2"
              style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
            />
          </div>

          {/* ── Body area ────────────────────────────────────────────────── */}
          <div
            className={`flex-1 min-h-0 relative ${isDragOver ? "bg-blue-50" : "bg-white"}`}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <textarea
              value={form.body}
              onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
              placeholder={isDragOver ? "Drop files here…" : ""}
              className="w-full h-full resize-none border-0 outline-none bg-transparent px-4 py-3 text-[13px] text-[#323130]"
              style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", lineHeight: 1.6 }}
            />
            {isDragOver && (
              <div className="absolute inset-0 border-2 border-dashed border-[#0078d4] bg-blue-50/80 flex items-center justify-center pointer-events-none rounded">
                <span className="text-[#0078d4] text-sm font-medium">Drop files to attach</span>
              </div>
            )}
          </div>

          {/* ── Attached files ───────────────────────────────────────────── */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 py-2 border-t border-[#e1dfdd] bg-[#faf9f8] shrink-0">
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-white border border-[#e1dfdd] rounded px-2 py-1 text-[12px] text-[#323130] max-w-[200px] shadow-sm">
                  <FileIcon className="w-3.5 h-3.5 text-[#0078d4] shrink-0" />
                  <span className="truncate">{a.filename}</span>
                  <span className="text-[#605e5c] shrink-0">{formatBytes(a.size)}</span>
                  <button onClick={() => setAttachments(p => p.filter((_, j) => j !== i))} className="text-[#605e5c] hover:text-[#c42b1c] shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Client Document Explorer ──────────────────────────────── */}
        {showExplorer && (
          <div className="w-64 border-l border-[#e1dfdd] flex flex-col bg-[#faf9f8] shrink-0">
            {/* Explorer header */}
            <div className="px-3 py-2 border-b border-[#e1dfdd] bg-white">
              <p className="text-[11px] font-semibold text-[#323130] uppercase tracking-wide mb-1.5">Client Document Explorer</p>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#605e5c]" />
                <input
                  value={explorerSearch}
                  onChange={e => setExplorerSearch(e.target.value)}
                  placeholder="Search client or ref…"
                  className="w-full text-[12px] border border-[#e1dfdd] rounded pl-6 pr-2 py-1 outline-none focus:border-[#0078d4] bg-white"
                  style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
                />
              </div>
            </div>

            {/* Tab strip */}
            <div className="flex overflow-x-auto border-b border-[#e1dfdd] bg-white shrink-0">
              {EXPLORER_TABS.map(t => {
                const count = explorerResults[t.key].length;
                return (
                  <button
                    key={t.key}
                    onClick={() => setExplorerTab(t.key)}
                    className={`px-2 py-1.5 text-[10px] whitespace-nowrap border-b-2 transition-colors shrink-0
                      ${explorerTab === t.key
                        ? "border-[#0078d4] text-[#0078d4] font-semibold"
                        : "border-transparent text-[#605e5c] hover:text-[#323130]"}`}
                  >
                    {t.label}{count > 0 && <span className="ml-1 bg-[#0078d4] text-white text-[9px] rounded-full px-1">{count}</span>}
                  </button>
                );
              })}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {explorerSearch.length < 2 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-3 py-8 gap-2">
                  <Search className="w-8 h-8 text-[#c8c6c4]" />
                  <p className="text-[11px] text-[#605e5c]">Type a client name or document reference</p>
                </div>
              ) : explorerLoading ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="w-5 h-5 animate-spin text-[#0078d4]" />
                </div>
              ) : currentTabResults.length === 0 ? (
                <div className="text-center py-8 px-3">
                  <p className="text-[11px] text-[#605e5c]">No {EXPLORER_TABS.find(t => t.key === explorerTab)?.label.toLowerCase()} found</p>
                  {totalDocResults > 0 && (
                    <p className="text-[10px] text-[#a19f9d] mt-1">{totalDocResults} result{totalDocResults !== 1 ? "s" : ""} in other tabs</p>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-[#edebe9]">
                  {currentTabResults.map(doc => {
                    const key = `${explorerTab}-${doc.id}`;
                    const attached = attachedDocIds.has(key);
                    return (
                      <div key={doc.id} className="px-3 py-2 hover:bg-white transition-colors group">
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-[#0078d4] truncate">{doc.label}</p>
                            {doc.sub && <p className="text-[10px] text-[#605e5c] truncate">{doc.sub}</p>}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {doc.amount && <span className="text-[10px] text-[#107c10] font-medium">{doc.amount}</span>}
                              {doc.status && (
                                <span className={`text-[9px] px-1 py-0.5 rounded ${
                                  doc.status === "approved" || doc.status === "paid"
                                    ? "bg-[#dff6dd] text-[#107c10]"
                                    : "bg-[#f3f2f1] text-[#605e5c]"
                                }`}>{doc.status}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => attachDoc(explorerTab, doc)}
                            disabled={attached}
                            title={attached ? "Already attached" : "Attach to email"}
                            className={`shrink-0 mt-0.5 p-1 rounded transition-colors
                              ${attached
                                ? "text-[#107c10] bg-[#dff6dd]"
                                : "text-[#605e5c] hover:bg-[#0078d4] hover:text-white"}`}
                          >
                            {attached
                              ? <FileCheck className="w-3.5 h-3.5" />
                              : <Paperclip className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-3 py-1.5 border-t border-[#e1dfdd] bg-white">
              <p className="text-[10px] text-[#a19f9d]">Click <Paperclip className="w-2.5 h-2.5 inline" /> to attach document reference</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
