import { useState } from "react";
import { Check, Plus, Trash2, ChevronDown, Info, Banknote, CalendarDays, Shuffle } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  distributePDCCheques,
  isPDCPaymentTerms,
  isCDCPDCPaymentTerms,
  buildPDCTermsText,
  buildCDCTermsText,
  buildCDCPDCTermsText,
  parsePDCPaymentTerms,
  parseCDCPDCTerms,
  parsePaymentTerms,
  totalPercent,
  type CDCInstallment,
} from "@/lib/payment-terms";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type PaymentMode = "cdc" | "pdc" | "cdcpdc";

function detectMode(value: string): PaymentMode {
  if (isPDCPaymentTerms(value)) return "pdc";
  if (isCDCPDCPaymentTerms(value)) return "cdcpdc";
  return "cdc";
}

const CDC_PRESETS: Array<{ label: string; split: string; installments: CDCInstallment[] }> = [
  {
    label: "100% Advance",
    split: "100",
    installments: [{ label: "Advance", percent: 100 }],
  },
  {
    label: "75 / 25",
    split: "75+25",
    installments: [
      { label: "Advance", percent: 75 },
      { label: "Before Delivery", percent: 25 },
    ],
  },
  {
    label: "50 / 50",
    split: "50+50",
    installments: [
      { label: "Advance", percent: 50 },
      { label: "Before Delivery", percent: 50 },
    ],
  },
  {
    label: "30 / 40 / 30",
    split: "30+40+30",
    installments: [
      { label: "Advance", percent: 30 },
      { label: "Progress Payment", percent: 40 },
      { label: "Final Payment", percent: 30 },
    ],
  },
  {
    label: "25 / 50 / 25",
    split: "25+50+25",
    installments: [
      { label: "Advance", percent: 25 },
      { label: "Progress Payment", percent: 50 },
      { label: "Final Payment", percent: 25 },
    ],
  },
  {
    label: "25 / 25 / 25 / 25",
    split: "25+25+25+25",
    installments: [
      { label: "Advance", percent: 25 },
      { label: "Progress Payment 1", percent: 25 },
      { label: "Progress Payment 2", percent: 25 },
      { label: "Final Payment", percent: 25 },
    ],
  },
];

const STAGE_OPTIONS: Array<{ label: string; hint: string }> = [
  { label: "Advance", hint: "Paid at contract signing / LPO receipt" },
  { label: "On LPO", hint: "Upon issuance of Local Purchase Order" },
  { label: "Mobilisation", hint: "Before site work / manufacturing begins" },
  { label: "Progress Payment", hint: "Milestone reached during construction" },
  { label: "Progress Payment 1", hint: "First progress milestone" },
  { label: "Progress Payment 2", hint: "Second progress milestone" },
  { label: "Progress Payment 3", hint: "Third progress milestone" },
  { label: "Before Delivery", hint: "Before goods leave factory / site" },
  { label: "On Delivery", hint: "Upon delivery to site" },
  { label: "On Installation", hint: "After installation is complete" },
  { label: "On Handover", hint: "At official project handover" },
  { label: "Final Payment", hint: "Last payment — closes the contract" },
  { label: "Retention", hint: "Held back until defect liability period ends" },
];

// ─── Percent allocation bar ────────────────────────────────────────────────
const BAR_COLORS = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-teal-500",
];

function AllocationBar({ rows }: { rows: Array<{ label: string; percent: number }> }) {
  const total = rows.reduce((s, r) => s + (Number(r.percent) || 0), 0);
  if (total === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {rows.map((r, i) => {
          const w = Math.max(0, ((Number(r.percent) || 0) / Math.max(total, 100)) * 100);
          return (
            <div
              key={i}
              className={`h-full transition-all ${BAR_COLORS[i % BAR_COLORS.length]}`}
              style={{ width: `${w}%` }}
              title={`${r.label}: ${r.percent}%`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {rows.map((r, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            <span className={`inline-block w-2 h-2 rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`} />
            {r.label}: <strong>{r.percent}%</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Row number badge ──────────────────────────────────────────────────────
function RowBadge({ n, color }: { n: number; color: string }) {
  return (
    <span
      className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${color}`}
    >
      {n}
    </span>
  );
}

interface PaymentTermsBuilderProps {
  value: string;
  onChange: (value: string) => void;
  /** Pass the quotation grand total (incl. VAT) to unlock AED-amount entry mode,
   *  so users type clean AED amounts instead of manually calculating percentages. */
  grandTotal?: number;
}

export function PaymentTermsBuilder({ value, onChange, grandTotal = 0 }: PaymentTermsBuilderProps) {
  const [mode, setMode] = useState<PaymentMode>(() => detectMode(value));

  const [cdcRows, setCdcRows] = useState<CDCInstallment[]>(() => {
    if (isPDCPaymentTerms(value) || isCDCPDCPaymentTerms(value))
      return [{ label: "Advance", percent: 100 }];
    const parsed = parsePaymentTerms(value);
    return parsed.length > 0
      ? parsed.map((p) => ({ label: p.label, percent: p.percent }))
      : [{ label: "Advance", percent: 100 }];
  });

  const [pdcCheques, setPdcCheques] = useState<Array<{ percent: number; date: string }>>(() => {
    if (isPDCPaymentTerms(value)) {
      const p = parsePDCPaymentTerms(value);
      return p.length > 0 ? p.map((x) => ({ percent: x.percent, date: x.dueDate ?? "" })) : distributePDCCheques(3);
    }
    if (isCDCPDCPaymentTerms(value)) {
      const d = parseCDCPDCTerms(value);
      return d.pdcCheques.length > 0 ? d.pdcCheques : distributePDCCheques(2);
    }
    return distributePDCCheques(3);
  });

  const [cdcPdcCdc, setCdcPdcCdc] = useState<CDCInstallment[]>(() => {
    if (isCDCPDCPaymentTerms(value)) {
      const d = parseCDCPDCTerms(value);
      return d.cdcInstallments.length > 0 ? d.cdcInstallments : [{ label: "Advance", percent: 30 }];
    }
    return [{ label: "Advance", percent: 30 }];
  });

  const [cdcPdcPdc, setCdcPdcPdc] = useState<Array<{ percent: number; date: string }>>(() => {
    if (isCDCPDCPaymentTerms(value)) {
      const d = parseCDCPDCTerms(value);
      return d.pdcCheques.length > 0 ? d.pdcCheques : distributePDCCheques(2);
    }
    return distributePDCCheques(2);
  });

  // ── AED-amount entry mode (CDC only) ──────────────────────────────────────
  // Lets users type exact AED amounts; percentages are auto-calculated.
  const [byAmt, setByAmt] = useState(false);
  const [amtRows, setAmtRows] = useState<number[]>([]);
  const toggleByAmt = () => {
    if (!byAmt && grandTotal > 0) {
      setAmtRows(cdcRows.map(r => +(r.percent * grandTotal / 100).toFixed(2)));
      setByAmt(true);
    } else {
      setByAmt(false);
    }
  };
  const amtTotal = amtRows.reduce((s, a) => s + (Number(a) || 0), 0);

  const switchMode = (next: PaymentMode) => {
    setMode(next);
    if (next === "cdc") onChange(buildCDCTermsText(cdcRows));
    else if (next === "pdc") {
      const c = pdcCheques.length > 0 ? pdcCheques : distributePDCCheques(3);
      setPdcCheques(c);
      onChange(buildPDCTermsText(c));
    } else {
      onChange(buildCDCPDCTermsText({ cdcInstallments: cdcPdcCdc, pdcCheques: cdcPdcPdc }));
    }
  };

  const cdcTotal = totalPercent(cdcRows);
  const pdcTotal = pdcCheques.reduce((s, c) => s + (Number(c.percent) || 0), 0);
  const cdcPdcTotal =
    totalPercent(cdcPdcCdc) + cdcPdcPdc.reduce((s, c) => s + (Number(c.percent) || 0), 0);
  const isBalanced = (pct: number) => Math.abs(pct - 100) < 0.01;

  // ── CDC helpers ──
  const updateCdcRow = (i: number, patch: Partial<CDCInstallment>) => {
    const u = cdcRows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    setCdcRows(u); onChange(buildCDCTermsText(u));
  };
  const addCdcRow = () => {
    const u = [...cdcRows, { label: "Progress Payment", percent: 0 }];
    setCdcRows(u); onChange(buildCDCTermsText(u));
    if (byAmt) setAmtRows(a => [...a, 0]);
  };
  const removeCdcRow = (i: number) => {
    const u = cdcRows.filter((_, idx) => idx !== i);
    setCdcRows(u); onChange(buildCDCTermsText(u));
    if (byAmt) setAmtRows(a => a.filter((_, idx) => idx !== i));
  };
  const applyPreset = (inst: CDCInstallment[]) => {
    setCdcRows(inst); onChange(buildCDCTermsText(inst));
    if (byAmt && grandTotal > 0) setAmtRows(inst.map(r => +(r.percent * grandTotal / 100).toFixed(2)));
  };

  // ── PDC helpers ──
  const updatePdc = (u: Array<{ percent: number; date: string }>) => { setPdcCheques(u); onChange(buildPDCTermsText(u)); };
  const setPdcCount = (n: number) => {
    if (n < 1 || n > 24) return;
    const fresh = distributePDCCheques(n);
    updatePdc(fresh.map((c, i) => ({ percent: c.percent, date: pdcCheques[i]?.date ?? "" })));
  };

  // ── CDC+PDC helpers ──
  const updateCdcPdcCdc = (i: number, patch: Partial<CDCInstallment>) => {
    const u = cdcPdcCdc.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    setCdcPdcCdc(u); onChange(buildCDCPDCTermsText({ cdcInstallments: u, pdcCheques: cdcPdcPdc }));
  };
  const addCdcPdcCdcRow = () => {
    const u = [...cdcPdcCdc, { label: "Progress Payment", percent: 0 }];
    setCdcPdcCdc(u); onChange(buildCDCPDCTermsText({ cdcInstallments: u, pdcCheques: cdcPdcPdc }));
  };
  const removeCdcPdcCdcRow = (i: number) => {
    const u = cdcPdcCdc.filter((_, idx) => idx !== i);
    setCdcPdcCdc(u); onChange(buildCDCPDCTermsText({ cdcInstallments: u, pdcCheques: cdcPdcPdc }));
  };
  const updateCdcPdcPdc = (u: Array<{ percent: number; date: string }>) => {
    setCdcPdcPdc(u); onChange(buildCDCPDCTermsText({ cdcInstallments: cdcPdcCdc, pdcCheques: u }));
  };
  const setCdcPdcCount = (n: number) => {
    if (n < 1 || n > 24) return;
    const fresh = distributePDCCheques(n);
    updateCdcPdcPdc(fresh.map((c, i) => ({ percent: c.percent, date: cdcPdcPdc[i]?.date ?? "" })));
  };

  // ── Shared stage dropdown ──────────────────────────────────────────────────
  const StageDropdown = ({
    label,
    onSelect,
    accentClass,
  }: {
    label: string;
    onSelect: (l: string) => void;
    accentClass?: string;
  }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="h-9 px-3 text-sm text-left rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-2 w-full"
        >
          <span className="truncate font-medium">{label || "Select payment stage…"}</span>
          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
          Payment Milestones
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {STAGE_OPTIONS.map((s) => (
          <DropdownMenuItem
            key={s.label}
            onSelect={() => onSelect(s.label)}
            className="flex flex-col items-start py-2 gap-0.5"
          >
            <span className="font-medium text-sm">{s.label}</span>
            <span className="text-[10px] text-slate-400">{s.hint}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            const custom = prompt("Enter custom stage / milestone name:");
            if (custom?.trim()) onSelect(custom.trim());
          }}
          className="text-violet-600 dark:text-violet-400 font-medium"
        >
          ✏️ Type custom stage name…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // ── Total pill ─────────────────────────────────────────────────────────────
  const TotalPill = ({ total, balanced }: { total: number; balanced: boolean }) => (
    <div
      className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
        balanced
          ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300"
          : total > 100
          ? "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-300"
          : "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-300"
      }`}
    >
      {balanced ? (
        <><Check className="w-3 h-3" strokeWidth={3} /> Total: {total.toFixed(0)}% ✓</>
      ) : total > 100 ? (
        <>⚠ Over by {(total - 100).toFixed(0)}%</>
      ) : (
        <>Remaining: {(100 - total).toFixed(0)}% to allocate</>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">

        {/* ══ STEP 1 — Mode selector ══════════════════════════════════════ */}
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-black text-slate-600 dark:text-slate-300">1</span>
            Select payment method
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                {
                  id: "cdc" as PaymentMode,
                  Icon: Banknote,
                  title: "CDC",
                  full: "Current-Dated Cheque",
                  desc: "Cheque, cash, or bank transfer — paid immediately or on agreed date.",
                  bestFor: "Short projects · Full advance · Standard milestone splits",
                  example: "e.g. 50% Advance + 50% Before Delivery",
                  color: "emerald",
                },
                {
                  id: "pdc" as PaymentMode,
                  Icon: CalendarDays,
                  title: "PDC",
                  full: "Post-Dated Cheques",
                  desc: "Client hands over all cheques at signing. Each cheque has a future encashment date.",
                  bestFor: "Longer projects · Bank security · UAE standard practice",
                  example: "e.g. 3 cheques: 33% each, spaced 3 months apart",
                  color: "blue",
                },
                {
                  id: "cdcpdc" as PaymentMode,
                  Icon: Shuffle,
                  title: "CDC + PDC",
                  full: "Mixed Payment",
                  desc: "Advance paid by CDC (cash/current cheque) + remaining balance secured by PDC.",
                  bestFor: "Large contracts · Advance now + future PDC commitment",
                  example: "e.g. 30% Advance CDC + 2 PDC cheques 35% each",
                  color: "violet",
                },
              ] as const
            ).map((opt) => {
              const selected = mode === opt.id;
              const border = {
                emerald: selected ? "border-emerald-500 shadow-emerald-100 dark:shadow-emerald-900/30 shadow-md" : "border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700",
                blue: selected ? "border-blue-500 shadow-blue-100 dark:shadow-blue-900/30 shadow-md" : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700",
                violet: selected ? "border-violet-500 shadow-violet-100 dark:shadow-violet-900/30 shadow-md" : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700",
              }[opt.color];
              const bg = {
                emerald: selected ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-white dark:bg-slate-900",
                blue: selected ? "bg-blue-50 dark:bg-blue-950/40" : "bg-white dark:bg-slate-900",
                violet: selected ? "bg-violet-50 dark:bg-violet-950/40" : "bg-white dark:bg-slate-900",
              }[opt.color];
              const iconBg = {
                emerald: selected ? "bg-emerald-500" : "bg-slate-100 dark:bg-slate-800",
                blue: selected ? "bg-blue-500" : "bg-slate-100 dark:bg-slate-800",
                violet: selected ? "bg-violet-500" : "bg-slate-100 dark:bg-slate-800",
              }[opt.color];
              const iconColor = selected ? "text-white" : "text-slate-400 dark:text-slate-500";
              const titleColor = {
                emerald: selected ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-slate-200",
                blue: selected ? "text-blue-700 dark:text-blue-300" : "text-slate-800 dark:text-slate-200",
                violet: selected ? "text-violet-700 dark:text-violet-300" : "text-slate-800 dark:text-slate-200",
              }[opt.color];
              const checkRing = {
                emerald: selected ? "bg-emerald-500 border-emerald-500" : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600",
                blue: selected ? "bg-blue-500 border-blue-500" : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600",
                violet: selected ? "bg-violet-500 border-violet-500" : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600",
              }[opt.color];

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => switchMode(opt.id)}
                  className={`relative rounded-xl border-2 p-3 text-left transition-all cursor-pointer ${border} ${bg}`}
                >
                  {/* Top row: icon + check */}
                  <div className="flex items-start justify-between mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${iconBg}`}>
                      <opt.Icon className={`w-4 h-4 transition-all ${iconColor}`} />
                    </div>
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${checkRing}`}
                    >
                      {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </span>
                  </div>

                  {/* Title */}
                  <p className={`text-base font-black leading-tight mb-0.5 ${titleColor}`}>{opt.title}</p>
                  <p className={`text-[11px] font-semibold mb-1.5 ${titleColor} opacity-80`}>{opt.full}</p>

                  {/* Description */}
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2">{opt.desc}</p>

                  {/* Best for */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Best for</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">{opt.bestFor}</p>
                  </div>

                  {/* Example */}
                  <p className={`mt-1.5 text-[9px] italic ${titleColor} opacity-60`}>{opt.example}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ══ STEP 2 — Builder ════════════════════════════════════════════ */}
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-black text-slate-600 dark:text-slate-300">2</span>
            Configure payment installments
          </p>

          {/* ── CDC ── */}
          {mode === "cdc" && (
            <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-200 dark:border-emerald-900 bg-emerald-100/60 dark:bg-emerald-950/40">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                    Current-Dated Cheque / Cash (CDC)
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-emerald-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-56 text-xs">
                      Payments made by cash, bank transfer, or current-dated cheques. Each installment is tied to a
                      project milestone. Add as many stages as needed — they must total 100%.
                    </TooltipContent>
                  </Tooltip>
                </div>
                {grandTotal > 0 && (
                  <button
                    type="button"
                    onClick={toggleByAmt}
                    className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border transition-all ${
                      byAmt
                        ? "bg-emerald-100 dark:bg-emerald-900/50 border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300"
                        : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-500 hover:border-emerald-300 hover:text-emerald-600"
                    }`}
                  >
                    {byAmt ? "↔ Switch to %" : "↔ Enter by AED Amount"}
                  </button>
                )}
              </div>

              {/* Quick presets */}
              <div className="px-4 pt-3 pb-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Quick presets</p>
                <div className="flex flex-wrap gap-1.5">
                  {CDC_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPreset(p.installments)}
                      className="px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Installment rows */}
              <div className="px-4 pb-2 space-y-2">
                {/* Column headers */}
                <div className={`grid ${byAmt ? "grid-cols-[28px_1fr_130px_52px_36px]" : "grid-cols-[28px_1fr_100px_36px]"} gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide pl-0.5`}>
                  <span>#</span>
                  <span>Payment Stage / Milestone</span>
                  {byAmt ? <span>Amount (AED)</span> : <span>% of Total</span>}
                  {byAmt && <span className="text-center">%</span>}
                  <span />
                </div>

                {cdcRows.map((row, i) => (
                  <div key={i} className={`grid ${byAmt ? "grid-cols-[28px_1fr_130px_52px_36px]" : "grid-cols-[28px_1fr_100px_36px]"} gap-2 items-center`}>
                    <RowBadge n={i + 1} color="bg-emerald-500" />

                    <StageDropdown
                      label={row.label}
                      onSelect={(l) => updateCdcRow(i, { label: l })}
                      accentClass="emerald"
                    />

                    {byAmt ? (
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none select-none">AED</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={amtRows[i] ?? ""}
                          placeholder="0.00"
                          onChange={(e) => {
                            const amt = parseFloat(e.target.value) || 0;
                            setAmtRows(a => a.map((x, idx) => idx === i ? amt : x));
                            updateCdcRow(i, { percent: grandTotal > 0 ? +(amt / grandTotal * 100).toFixed(5) : 0 });
                          }}
                          className="pl-10 pr-1 h-9 text-sm font-mono font-semibold text-right"
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={row.percent || ""}
                          placeholder="0"
                          onChange={(e) => updateCdcRow(i, { percent: parseFloat(e.target.value) || 0 })}
                          className="pr-8 h-9 text-sm font-mono font-semibold text-center"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                      </div>
                    )}

                    {byAmt && (
                      <span className="text-[11px] font-semibold text-slate-400 text-center tabular-nums">
                        {grandTotal > 0 ? `${+row.percent.toFixed(1)}%` : "—"}
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={cdcRows.length <= 1}
                      onClick={() => removeCdcRow(i)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-300 dark:hover:border-red-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-emerald-200 dark:border-emerald-900 bg-white/60 dark:bg-slate-950/40">
                <button
                  type="button"
                  onClick={addCdcRow}
                  className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add installment
                </button>
                {byAmt && grandTotal > 0 ? (
                  <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                    Math.abs(amtTotal - grandTotal) < 1
                      ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300"
                      : amtTotal > grandTotal
                      ? "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-300"
                      : "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-300"
                  }`}>
                    {Math.abs(amtTotal - grandTotal) < 1 ? (
                      <><Check className="w-3 h-3" strokeWidth={3} /> AED {grandTotal.toLocaleString("en-AE", { minimumFractionDigits: 2 })} ✓</>
                    ) : amtTotal > grandTotal ? (
                      <>⚠ Over by AED {(amtTotal - grandTotal).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</>
                    ) : (
                      <>Remaining: AED {(grandTotal - amtTotal).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</>
                    )}
                  </div>
                ) : (
                  <TotalPill total={cdcTotal} balanced={isBalanced(cdcTotal)} />
                )}
              </div>

              {/* Allocation bar */}
              {cdcRows.some((r) => r.percent > 0) && (
                <div className="px-4 pb-4">
                  <AllocationBar rows={cdcRows} />
                </div>
              )}
            </div>
          )}

          {/* ── PDC ── */}
          {mode === "pdc" && (
            <div className="rounded-xl border-2 border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 dark:border-blue-900 bg-blue-100/60 dark:bg-blue-950/40">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide">
                    Post-Dated Cheques (PDC)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-200 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                    {pdcCheques.length} cheque{pdcCheques.length !== 1 ? "s" : ""}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-blue-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-56 text-xs">
                      Client provides all cheques at contract signing. Each cheque has a future date — the bank cannot
                      cash it before that date. Standard UAE construction practice for instalment security.
                    </TooltipContent>
                  </Tooltip>
                </div>
                {/* Count adjuster */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-medium">Number of cheques:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPdcCount(pdcCheques.length - 1)}
                      className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-sm transition-colors"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm font-black">{pdcCheques.length}</span>
                    <button
                      type="button"
                      onClick={() => setPdcCount(pdcCheques.length + 1)}
                      className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-sm transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Cheque rows */}
              <div className="px-4 pt-3 pb-2 space-y-2">
                {/* Column headers */}
                <div className="grid grid-cols-[28px_100px_1fr] gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  <span>#</span>
                  <span>% of Total</span>
                  <span>Due Date — when can the bank encash this cheque?</span>
                </div>

                {pdcCheques.map((c, i) => (
                  <div key={i} className="grid grid-cols-[28px_100px_1fr] gap-3 items-center">
                    <RowBadge n={i + 1} color="bg-blue-500" />

                    <div className="relative">
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={c.percent || ""}
                        placeholder="0"
                        onChange={(e) => {
                          const u = pdcCheques.map((x, idx) =>
                            idx === i ? { ...x, percent: parseFloat(e.target.value) || 0 } : x
                          );
                          updatePdc(u);
                        }}
                        className="pr-8 h-9 text-sm font-mono font-semibold text-center"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                    </div>

                    <div className="relative">
                      <Input
                        type="text"
                        value={c.date}
                        onChange={(e) => {
                          const u = pdcCheques.map((x, idx) =>
                            idx === i ? { ...x, date: e.target.value } : x
                          );
                          updatePdc(u);
                        }}
                        placeholder="DD/MM/YYYY — e.g. 15/06/2026"
                        className="h-9 text-sm font-mono pl-3"
                      />
                      {c.date && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-blue-500 font-semibold">
                          ✓
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-blue-200 dark:border-blue-900 bg-white/60 dark:bg-slate-950/40">
                <p className="text-[11px] text-slate-500 italic">
                  All cheques are handed to the client at contract signing
                </p>
                <TotalPill total={pdcTotal} balanced={isBalanced(pdcTotal)} />
              </div>

              {/* Allocation bar */}
              {pdcCheques.some((c) => c.percent > 0) && (
                <div className="px-4 pb-4">
                  <AllocationBar rows={pdcCheques.map((c, i) => ({ label: `Cheque #${i + 1}`, percent: c.percent }))} />
                </div>
              )}
            </div>
          )}

          {/* ── CDC + PDC ── */}
          {mode === "cdcpdc" && (
            <div className="rounded-xl border-2 border-violet-200 dark:border-violet-900 bg-violet-50/40 dark:bg-violet-950/20 overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-violet-200 dark:border-violet-900 bg-violet-100/60 dark:bg-violet-950/40">
                <Shuffle className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span className="text-xs font-bold text-violet-800 dark:text-violet-300 uppercase tracking-wide">
                  Mixed Payment (CDC + PDC)
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-violet-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-60 text-xs">
                    The advance is paid by current-dated cheque or cash (CDC). The remaining instalments are secured by
                    post-dated cheques (PDC) handed over at contract signing.
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* ── CDC section ── */}
              <div className="px-4 pt-4 pb-3 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                    CDC installments
                  </span>
                  <span className="text-[10px] text-slate-400">(cash / current-dated cheque — paid immediately)</span>
                </div>

                <div className="grid grid-cols-[28px_1fr_100px_36px] gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide pl-0.5">
                  <span>#</span>
                  <span>Payment Stage / Milestone</span>
                  <span>% of Total</span>
                  <span />
                </div>

                {cdcPdcCdc.map((row, i) => (
                  <div key={i} className="grid grid-cols-[28px_1fr_100px_36px] gap-2 items-center">
                    <RowBadge n={i + 1} color="bg-emerald-500" />
                    <StageDropdown label={row.label} onSelect={(l) => updateCdcPdcCdc(i, { label: l })} />
                    <div className="relative">
                      <Input
                        type="number" min="1" max="100"
                        value={row.percent || ""} placeholder="0"
                        onChange={(e) => updateCdcPdcCdc(i, { percent: parseFloat(e.target.value) || 0 })}
                        className="pr-8 h-9 text-sm font-mono font-semibold text-center"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                    </div>
                    <button
                      type="button"
                      disabled={cdcPdcCdc.length <= 1}
                      onClick={() => removeCdcPdcCdcRow(i)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-300 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addCdcPdcCdcRow}
                  className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add CDC installment
                </button>
              </div>

              {/* divider */}
              <div className="mx-4 border-t-2 border-dashed border-violet-200 dark:border-violet-800" />

              {/* ── PDC section ── */}
              <div className="px-4 pt-3 pb-3 space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                      PDC cheques
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-[10px] font-bold">
                      {cdcPdcPdc.length} cheque{cdcPdcPdc.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[10px] text-slate-400">(post-dated — handed at signing)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setCdcPdcCount(cdcPdcPdc.length - 1)}
                      className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 font-bold text-sm transition-colors">−</button>
                    <span className="w-7 text-center text-sm font-black">{cdcPdcPdc.length}</span>
                    <button type="button" onClick={() => setCdcPdcCount(cdcPdcPdc.length + 1)}
                      className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 font-bold text-sm transition-colors">+</button>
                  </div>
                </div>

                <div className="grid grid-cols-[28px_100px_1fr] gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  <span>#</span><span>% of Total</span><span>Due Date (DD/MM/YYYY)</span>
                </div>

                {cdcPdcPdc.map((c, i) => (
                  <div key={i} className="grid grid-cols-[28px_100px_1fr] gap-3 items-center">
                    <RowBadge n={i + 1} color="bg-blue-500" />
                    <div className="relative">
                      <Input
                        type="number" min="1" max="100"
                        value={c.percent || ""} placeholder="0"
                        onChange={(e) => {
                          const u = cdcPdcPdc.map((x, idx) => idx === i ? { ...x, percent: parseFloat(e.target.value) || 0 } : x);
                          updateCdcPdcPdc(u);
                        }}
                        className="pr-8 h-9 text-sm font-mono font-semibold text-center"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                    </div>
                    <Input
                      type="text" value={c.date}
                      onChange={(e) => {
                        const u = cdcPdcPdc.map((x, idx) => idx === i ? { ...x, date: e.target.value } : x);
                        updateCdcPdcPdc(u);
                      }}
                      placeholder="DD/MM/YYYY — e.g. 15/09/2026"
                      className="h-9 text-sm font-mono"
                    />
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-violet-200 dark:border-violet-900 bg-white/60 dark:bg-slate-950/40">
                <span className="text-[11px] text-slate-500">
                  CDC <strong className="text-emerald-600">{totalPercent(cdcPdcCdc).toFixed(0)}%</strong>
                  {" "}+{" "}PDC <strong className="text-blue-600">{cdcPdcPdc.reduce((s, c) => s + (Number(c.percent) || 0), 0).toFixed(0)}%</strong>
                </span>
                <TotalPill total={cdcPdcTotal} balanced={isBalanced(cdcPdcTotal)} />
              </div>

              {/* Allocation bar */}
              {cdcPdcTotal > 0 && (
                <div className="px-4 pb-4">
                  <AllocationBar
                    rows={[
                      ...cdcPdcCdc.map((r) => ({ label: `${r.label} (CDC)`, percent: r.percent })),
                      ...cdcPdcPdc.map((c, i) => ({ label: `PDC Cheque #${i + 1}`, percent: c.percent })),
                    ]}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══ STEP 3 — Summary ════════════════════════════════════════════ */}
        {value && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-black text-slate-600 dark:text-slate-300">3</span>
              Summary — this is what will print on the document
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono break-all leading-relaxed">
              {value}
            </p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
