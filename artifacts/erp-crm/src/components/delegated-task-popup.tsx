import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useDelegatedTask } from "@/contexts/delegated-task-context";
import {
  Clock, CheckCircle2, X, FileText, FileCheck, Truck, ReceiptText,
  ShoppingCart, ClipboardList, ChevronUp, ChevronDown,
} from "lucide-react";
import { useLocation } from "wouter";

const TASK_TYPE_META: Record<string, { label: string; icon: React.ReactNode; href: string; color: string }> = {
  quotation:        { label: "New Quotation",        icon: <FileText className="w-5 h-5" />,     href: "/sales/quotations/new",      color: "#0078d4" },
  proforma_invoice: { label: "Proforma Invoice",     icon: <FileCheck className="w-5 h-5" />,    href: "/sales/proforma-invoices",   color: "#107c10" },
  tax_invoice:      { label: "Tax Invoice",          icon: <ReceiptText className="w-5 h-5" />,  href: "/sales/tax-invoices",        color: "#7719aa" },
  delivery_note:    { label: "Delivery Note",        icon: <Truck className="w-5 h-5" />,        href: "/sales/delivery-notes",      color: "#ca5010" },
  lpo:              { label: "Local Purchase Order", icon: <ShoppingCart className="w-5 h-5" />, href: "/procurement/lpos",          color: "#038387" },
  custom:           { label: "Task",                 icon: <ClipboardList className="w-5 h-5" />,href: "/",                          color: "#8a8886" },
};

function formatTimeLeft(expiresAt: string): { text: string; urgent: boolean; expired: boolean } {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { text: "Expired", urgent: true, expired: true };
  const totalSecs = Math.floor(diff / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return {
    text: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
    urgent: diff < 60_000,
    expired: false,
  };
}

export function DelegatedTaskPopup() {
  const { activeTask, completeTask, dismissTask } = useDelegatedTask();
  const [, navigate] = useLocation();
  const [timeLeft, setTimeLeft] = useState(() =>
    activeTask ? formatTimeLeft(activeTask.expiresAt) : { text: "00:00", urgent: false, expired: false }
  );
  const [done, setDone] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [widgetExpanded, setWidgetExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!activeTask) { setDone(false); setMinimized(false); return; }
    setTimeLeft(formatTimeLeft(activeTask.expiresAt));
    timerRef.current = setInterval(() => {
      const tl = formatTimeLeft(activeTask.expiresAt);
      setTimeLeft(tl);
      if (tl.expired) {
        // When expired, pop back to full-screen so user knows time is up
        setMinimized(false);
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeTask]);

  if (!activeTask || done) return null;

  const meta = TASK_TYPE_META[activeTask.taskType] ?? TASK_TYPE_META.custom;
  const { text: timerText, urgent, expired } = timeLeft;

  const handleOpenForm = () => {
    const href = activeTask.leadId && activeTask.taskType === "quotation"
      ? `/sales/quotations/new?leadId=${activeTask.leadId}`
      : meta.href;
    navigate(href);
    setMinimized(true);
    setWidgetExpanded(false);
  };

  const handleDone = async () => {
    setDone(true);
    await completeTask();
  };

  // ── Minimized floating widget ────────────────────────────────────────────
  if (minimized && !expired) {
    return createPortal(
      <div
        className="fixed z-[99999] select-none"
        style={{ bottom: 24, right: 24, width: 280 }}
      >
        <div
          className="rounded-xl shadow-2xl overflow-hidden"
          style={{ border: `2px solid ${meta.color}`, background: "#fff" }}
        >
          {/* Always-visible bar */}
          <div
            className="flex items-center gap-2 px-3 py-2 cursor-pointer"
            style={{ background: meta.color }}
            onClick={() => setWidgetExpanded(v => !v)}
          >
            <div className="text-white opacity-90 shrink-0">{meta.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-[11px] font-semibold uppercase tracking-widest opacity-80 leading-none mb-0.5">
                Active Task
              </div>
              <div className="text-white font-bold text-[13px] leading-tight truncate">
                {activeTask.taskLabel}
              </div>
            </div>
            {/* Timer */}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-full font-mono font-bold text-[15px] shrink-0"
              style={{
                background: urgent ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.18)",
                color: "#fff",
                animation: urgent ? "pulse 1s infinite" : undefined,
              }}
            >
              <Clock className="w-3.5 h-3.5 opacity-70" />
              {timerText}
            </div>
            <div className="text-white opacity-70 shrink-0">
              {widgetExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </div>
          </div>

          {/* Expandable panel */}
          {widgetExpanded && (
            <div className="px-3 py-3 flex flex-col gap-2">
              <button
                onClick={handleDone}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg font-semibold text-[14px] border transition-colors hover:bg-green-50"
                style={{ borderColor: "#107c10", color: "#107c10" }}
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark as Done
              </button>
              <button
                onClick={() => { setMinimized(false); }}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg font-semibold text-[13px] text-white hover:opacity-90 transition-opacity"
                style={{ background: meta.color }}
              >
                View Task Details
              </button>
            </div>
          )}
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      </div>,
      document.body
    );
  }

  // ── Full-screen blocking popup ───────────────────────────────────────────
  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative flex flex-col shadow-2xl"
        style={{
          width: "min(96vw, 480px)",
          borderRadius: 8,
          background: "#fff",
          border: `2px solid ${expired ? "#c50f1f" : meta.color}`,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ background: expired ? "#c50f1f" : meta.color }}>
          <div className="text-white opacity-90">{meta.icon}</div>
          <div className="flex-1">
            <div className="text-white text-[11px] font-semibold uppercase tracking-widest opacity-80">
              Task Delegated to You
            </div>
            <div className="text-white font-bold text-[16px] leading-tight">{meta.label}</div>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono font-bold text-[20px]"
            style={{
              background: urgent ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.18)",
              color: "#fff",
              minWidth: 90,
              justifyContent: "center",
              animation: urgent && !expired ? "pulse 1s infinite" : undefined,
            }}
          >
            <Clock className="w-4 h-4 opacity-70" />
            {timerText}
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pt-5 pb-4 flex flex-col gap-4">
          <div className="rounded-lg px-4 py-3" style={{ background: "#f3f2f1" }}>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#8a8886" }}>
              What you need to do
            </div>
            <div className="text-[15px] font-semibold" style={{ color: "#323130" }}>
              {activeTask.taskLabel}
            </div>
            {activeTask.leadName && (
              <div className="text-[13px] mt-1" style={{ color: "#605e5c" }}>
                Lead: {activeTask.leadName}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-[13px]" style={{ color: "#605e5c" }}>
            <span className="font-semibold" style={{ color: "#323130" }}>Assigned by:</span>
            {activeTask.grantedByName ?? "Admin"}
            <span className="mx-1">·</span>
            <span>{activeTask.durationMinutes} min window</span>
          </div>

          {expired ? (
            <div className="rounded-lg px-4 py-3 text-center font-semibold text-[15px]"
              style={{ background: "#fde7e9", color: "#c50f1f" }}>
              Time has expired. This task is now closed.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleOpenForm}
                className="flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-[15px] text-white transition-opacity hover:opacity-90 active:opacity-80"
                style={{ background: meta.color }}
              >
                {meta.icon}
                Open {meta.label} Form
              </button>
              <button
                onClick={handleDone}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-[14px] border transition-colors hover:bg-green-50"
                style={{ borderColor: "#107c10", color: "#107c10" }}
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark as Done
              </button>
            </div>
          )}
        </div>

        <div className="px-5 pb-4 text-center text-[12px]" style={{ color: "#a19f9d" }}>
          {expired
            ? "You can close this and contact the admin for a new delegation."
            : "Click \"Open Form\" to start working — the task widget will follow you as you work."}
        </div>

        {expired && (
          <button
            onClick={dismissTask}
            className="absolute top-3 right-3 p-1.5 rounded-full text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>,
    document.body
  );
}
