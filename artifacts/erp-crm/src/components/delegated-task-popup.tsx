import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useDelegatedTask } from "@/contexts/delegated-task-context";
import type { LeadPreview } from "@/contexts/delegated-task-context";
import {
  Clock, CheckCircle2, X, FileText, FileCheck, Truck, ReceiptText,
  ShoppingCart, ClipboardList, ChevronUp, ChevronDown,
  MapPin, DollarSign, Package, FileBarChart2, Globe,
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const TASK_TYPE_META: Record<string, { label: string; icon: React.ReactNode; href: string; color: string }> = {
  quotation:        { label: "New Quotation",        icon: <FileText className="w-5 h-5" />,     href: "/sales/quotations/new",    color: "#0078d4" },
  proforma_invoice: { label: "Proforma Invoice",     icon: <FileCheck className="w-5 h-5" />,    href: "/sales/proforma-invoices", color: "#107c10" },
  tax_invoice:      { label: "Tax Invoice",          icon: <ReceiptText className="w-5 h-5" />,  href: "/sales/tax-invoices",      color: "#7719aa" },
  delivery_note:    { label: "Delivery Note",        icon: <Truck className="w-5 h-5" />,        href: "/sales/delivery-notes",    color: "#ca5010" },
  lpo:              { label: "Local Purchase Order", icon: <ShoppingCart className="w-5 h-5" />, href: "/procurement/lpos",        color: "#038387" },
  custom:           { label: "Task",                 icon: <ClipboardList className="w-5 h-5" />,href: "/",                        color: "#8a8886" },
};

function formatTimeLeft(expiresAt: string): { text: string; urgent: boolean; expired: boolean } {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { text: "00:00", urgent: true, expired: true };
  const totalSecs = Math.floor(diff / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return {
    text: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
    urgent: diff < 60_000,
    expired: false,
  };
}

function LeadPreviewCard({ lead }: { lead: LeadPreview }) {
  const rows: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (lead.requirementType) rows.push({ icon: <FileBarChart2 className="w-3.5 h-3.5" />, label: "Requirement", value: lead.requirementType });
  if (lead.location || lead.officeAddress) rows.push({ icon: <MapPin className="w-3.5 h-3.5" />, label: "Location", value: lead.location ?? lead.officeAddress ?? "" });
  if (lead.budget) rows.push({ icon: <DollarSign className="w-3.5 h-3.5" />, label: "Budget", value: `AED ${lead.budget.toLocaleString()}` });
  if (lead.quantity) rows.push({ icon: <Package className="w-3.5 h-3.5" />, label: "Quantity", value: String(lead.quantity) });
  if (lead.source) rows.push({ icon: <Globe className="w-3.5 h-3.5" />, label: "Source", value: lead.source });

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#edebe9" }}>
      <div className="px-3 py-2 flex items-center justify-between" style={{ background: "#f3f2f1" }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8a8886" }}>
          Lead Details (contact info hidden)
        </span>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{
            background: lead.leadScore === "hot" ? "#fde7e9" : lead.leadScore === "warm" ? "#fff4ce" : "#ddf3d1",
            color: lead.leadScore === "hot" ? "#c50f1f" : lead.leadScore === "warm" ? "#835b00" : "#107c10",
          }}
        >
          {(lead.leadScore ?? "cold").toUpperCase()}
        </span>
      </div>
      <div className="px-3 py-2.5 flex flex-col gap-1.5" style={{ background: "#fff" }}>
        {rows.length === 0 ? (
          <p className="text-[12px]" style={{ color: "#a19f9d" }}>No additional project details available.</p>
        ) : rows.map((r, i) => (
          <div key={i} className="flex items-start gap-2 text-[12px]">
            <span className="mt-0.5 shrink-0" style={{ color: "#8a8886" }}>{r.icon}</span>
            <span className="font-medium shrink-0" style={{ color: "#605e5c", minWidth: 76 }}>{r.label}:</span>
            <span style={{ color: "#323130" }}>{r.value}</span>
          </div>
        ))}
        {lead.notes && (
          <div className="mt-1 pt-1.5 border-t text-[12px]" style={{ borderColor: "#edebe9", color: "#605e5c" }}>
            <span className="font-medium" style={{ color: "#323130" }}>Notes: </span>
            {lead.notes.length > 180 ? lead.notes.slice(0, 180) + "…" : lead.notes}
          </div>
        )}
      </div>
      <div className="px-3 py-1.5 text-[11px] flex items-center gap-1" style={{ background: "#fff4ce", color: "#835b00" }}>
        <X className="w-3 h-3" />
        Phone, email &amp; company name are hidden by the admin.
      </div>
    </div>
  );
}

export function DelegatedTaskPopup() {
  const { activeTask, completeTask, dismissTask } = useDelegatedTask();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(() =>
    activeTask ? formatTimeLeft(activeTask.expiresAt) : { text: "00:00", urgent: false, expired: false }
  );
  const [done, setDone] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [widgetExpanded, setWidgetExpanded] = useState(false);
  const [bubbleHovered, setBubbleHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!activeTask) { setDone(false); setMinimized(false); return; }
    setTimeLeft(formatTimeLeft(activeTask.expiresAt));
    timerRef.current = setInterval(() => {
      const tl = formatTimeLeft(activeTask.expiresAt);
      setTimeLeft(tl);
      if (tl.expired) setMinimized(false);
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeTask]);

  if (!activeTask || done) return null;

  const meta = TASK_TYPE_META[activeTask.taskType] ?? TASK_TYPE_META.custom;
  const { text: timerText, urgent, expired } = timeLeft;

  const handleOpenForm = () => {
    const href = activeTask.leadId && activeTask.taskType === "quotation"
      ? `/sales/quotations/new?leadId=${activeTask.leadId}&delegated=1`
      : meta.href;
    navigate(href);
    setMinimized(true);
    setWidgetExpanded(false);
    setBubbleHovered(false);
  };

  const handleDone = async () => {
    setDone(true);
    await completeTask();
    toast({
      title: "Thanks for your support!",
      description: "Task completed successfully.",
      duration: 3000,
    });
  };

  // ── Tiny bubble (after opening form) ─────────────────────────────────────
  if (minimized && !expired) {
    return createPortal(
      <div
        className="fixed z-[99999]"
        style={{ bottom: 28, right: 28 }}
        onMouseEnter={() => setBubbleHovered(true)}
        onMouseLeave={() => setBubbleHovered(false)}
      >
        {/* Main bubble */}
        <div
          onClick={bubbleHovered ? handleDone : () => setWidgetExpanded(v => !v)}
          className="w-16 h-16 rounded-full flex flex-col items-center justify-center cursor-pointer shadow-2xl select-none transition-all duration-200"
          style={{
            background: bubbleHovered ? "#107c10" : (urgent ? "#c50f1f" : meta.color),
            border: "3px solid rgba(255,255,255,0.9)",
            transform: bubbleHovered ? "scale(1.08)" : "scale(1)",
          }}
          title={bubbleHovered ? "Click to mark done" : "Active delegated task"}
        >
          {bubbleHovered ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span className="text-white text-[9px] font-bold mt-0.5 tracking-wide">DONE</span>
            </>
          ) : (
            <>
              <Clock className="w-4 h-4 text-white opacity-80" />
              <span
                className="text-white font-mono font-bold text-[13px] leading-none mt-0.5"
                style={{ animation: urgent ? "pulse 1s infinite" : undefined }}
              >
                {timerText}
              </span>
            </>
          )}
        </div>

        {/* Expanded panel — click bubble when not hovered */}
        {widgetExpanded && !bubbleHovered && (
          <div
            className="absolute bottom-[72px] right-0 rounded-xl shadow-2xl overflow-hidden"
            style={{ width: 300, border: `2px solid ${meta.color}`, background: "#fff" }}
          >
            <div className="flex items-center gap-2 px-3 py-2" style={{ background: meta.color }}>
              <div className="text-white opacity-90 shrink-0">{meta.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-[10px] font-semibold uppercase tracking-widest opacity-80">Active Task</div>
                <div className="text-white font-bold text-[13px] truncate">{activeTask.taskLabel}</div>
              </div>
              <button onClick={() => setWidgetExpanded(false)} className="text-white/70 hover:text-white">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <div className="px-3 py-3 flex flex-col gap-2">
              {activeTask.leadPreview && <LeadPreviewCard lead={activeTask.leadPreview} />}
              <button
                onClick={handleDone}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg font-semibold text-[14px] border transition-colors hover:bg-green-50"
                style={{ borderColor: "#107c10", color: "#107c10" }}
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark as Done
              </button>
              <button
                onClick={() => { setMinimized(false); setWidgetExpanded(false); }}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg font-semibold text-[13px] text-white hover:opacity-90 transition-opacity"
                style={{ background: meta.color }}
              >
                View Task Details
              </button>
            </div>
          </div>
        )}

        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      </div>,
      document.body
    );
  }

  // ── Full-screen popup ─────────────────────────────────────────────────────
  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative flex flex-col shadow-2xl overflow-y-auto"
        style={{
          width: "min(96vw, 520px)", maxHeight: "90vh", borderRadius: 8,
          background: "#fff", border: `2px solid ${expired ? "#c50f1f" : meta.color}`,
        }}
      >
        <div className="flex items-center gap-3 px-5 py-4 sticky top-0" style={{ background: expired ? "#c50f1f" : meta.color }}>
          <div className="text-white opacity-90">{meta.icon}</div>
          <div className="flex-1">
            <div className="text-white text-[11px] font-semibold uppercase tracking-widest opacity-80">Task Delegated to You</div>
            <div className="text-white font-bold text-[16px] leading-tight">{meta.label}</div>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono font-bold text-[20px]"
            style={{
              background: urgent ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.18)", color: "#fff",
              minWidth: 90, justifyContent: "center",
              animation: urgent && !expired ? "pulse 1s infinite" : undefined,
            }}
          >
            <Clock className="w-4 h-4 opacity-70" />{timerText}
          </div>
        </div>

        <div className="px-5 pt-5 pb-4 flex flex-col gap-4">
          <div className="rounded-lg px-4 py-3" style={{ background: "#f3f2f1" }}>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#8a8886" }}>What you need to do</div>
            <div className="text-[15px] font-semibold" style={{ color: "#323130" }}>{activeTask.taskLabel}</div>
          </div>

          <div className="flex items-center gap-2 text-[13px]" style={{ color: "#605e5c" }}>
            <span className="font-semibold" style={{ color: "#323130" }}>Assigned by:</span>
            {activeTask.grantedByName ?? "Admin"}
            <span className="mx-1">·</span>
            <span>{activeTask.durationMinutes} min window</span>
          </div>

          {activeTask.leadPreview && <LeadPreviewCard lead={activeTask.leadPreview} />}

          {expired ? (
            <div className="rounded-lg px-4 py-3 text-center font-semibold text-[15px]" style={{ background: "#fde7e9", color: "#c50f1f" }}>
              Time has expired. This task is now closed.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleOpenForm}
                className="flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-[15px] text-white transition-opacity hover:opacity-90"
                style={{ background: meta.color }}
              >
                {meta.icon} Open {meta.label} Form
              </button>
              <button
                onClick={handleDone}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-[14px] border transition-colors hover:bg-green-50"
                style={{ borderColor: "#107c10", color: "#107c10" }}
              >
                <CheckCircle2 className="w-4 h-4" /> Mark as Done
              </button>
            </div>
          )}
        </div>

        <div className="px-5 pb-4 text-center text-[12px]" style={{ color: "#a19f9d" }}>
          {expired
            ? "Contact the admin for a new delegation."
            : "Click \"Open Form\" — a small bubble will follow you as a reminder. Hover it to mark done."}
        </div>

        {expired && (
          <button onClick={dismissTask} className="absolute top-3 right-3 p-1.5 rounded-full text-white hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>,
    document.body
  );
}
