import { useMemo } from "react";
import { Link } from "wouter";
import {
  useListTaxInvoices, useListPaymentsReceived, useListPaymentsMade,
  useListExpenses, useListCheques, useListBankAccounts,
  useListJournalEntries, useListChartOfAccounts, useListDeliveryNotes,
} from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  XAxis, YAxis, CartesianGrid, Area, AreaChart,
} from "recharts";
import {
  Receipt, Wallet, Banknote, ArrowDownCircle, ArrowUpCircle,
  FileBox, Landmark, BookMarked, PieChart as PieIcon,
  Plus, Sparkles, TrendingUp, AlertTriangle, FileWarning,
  CreditCard, Building2, Activity, Clock,
  Truck, ShieldCheck, Calculator, BellRing,
} from "lucide-react";
import {
  ExecutiveHeader, KPIWidget, PremiumCard,
  weeklyCounts, weeklyValues, trendPct,
} from "@/components/crm/premium";

const STATUS_COLORS: Record<string, string> = {
  paid:    "#10b981",
  partial: "#f97316",
  unpaid:  "#ef4444",
  overdue: "#dc2626",
  draft:   "#94a3b8",
  pending: "#3b82f6",
  cleared: "#10b981",
  issued:  "#f97316",
  bounced: "#ef4444",
  cancelled: "#64748b",
};

const CATEGORY_PALETTE = [
  "#0f2d5a", "#1e6ab0", "#3b82f6", "#10b981", "#8b5cf6",
  "#f97316", "#ef4444", "#14b8a6", "#6366f1", "#64748b",
];

function fmtAED(n: number) {
  if (Math.abs(n) >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)     return `AED ${(n / 1_000).toFixed(1)}K`;
  return `AED ${Math.round(n).toLocaleString()}`;
}

function fmtNum(n: number) { return n.toLocaleString(); }

function daysSince(d: string | Date | null | undefined) {
  if (!d) return Infinity;
  const ms = Date.now() - new Date(d).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// Bucket key for a date in the user's LOCAL timezone (avoids the UTC-midnight
// drift that makes a Dubai-time payment dated "2024-05-01" land on Apr 30).
function localDayKey(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  const dt = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(`${d}T00:00:00`) // force local midnight, not UTC
    : new Date(d);
  if (!isFinite(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Local-midnight timestamp for the given date. Use this — not raw .getTime() —
// when computing whole-calendar-day differences (e.g. "days until cheque date"),
// otherwise the answer drifts depending on the user's wall-clock time-of-day.
function localDayMs(d: string | Date | null | undefined): number {
  if (!d) return NaN;
  const dt = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(`${d}T00:00:00`)
    : new Date(d);
  if (!isFinite(dt.getTime())) return NaN;
  dt.setHours(0, 0, 0, 0);
  return dt.getTime();
}

export function AccountsDashboard() {
  const { filterByCompany, activeCompanyId } = useActiveCompany();
  const categoryPalette = activeCompanyId === 2
    ? ["#8B0000", "#C00000", "#3b82f6", "#10b981", "#8b5cf6", "#f97316", "#ef4444", "#14b8a6", "#6366f1", "#64748b"]
    : CATEGORY_PALETTE;
  const { data: invoicesRaw, isLoading: invLoading } = useListTaxInvoices({});
  const { data: paymentsRecRaw } = useListPaymentsReceived();
  const { data: paymentsMadeRaw } = useListPaymentsMade();
  const { data: expensesRaw } = useListExpenses();
  const { data: chequesRaw } = useListCheques({});
  const { data: bankAccountsRaw } = useListBankAccounts();
  const { data: journalEntriesRaw } = useListJournalEntries();
  const { data: chartOfAccountsRaw } = useListChartOfAccounts();
  const { data: deliveryNotesRaw } = useListDeliveryNotes();

  const invoices       = useMemo(() => filterByCompany(invoicesRaw       ?? []), [invoicesRaw, filterByCompany]);
  const paymentsRec    = useMemo(() => filterByCompany(paymentsRecRaw    ?? []), [paymentsRecRaw, filterByCompany]);
  const paymentsMade   = useMemo(() => filterByCompany(paymentsMadeRaw   ?? []), [paymentsMadeRaw, filterByCompany]);
  const expenses       = useMemo(() => filterByCompany(expensesRaw       ?? []), [expensesRaw, filterByCompany]);
  const cheques        = useMemo(() => filterByCompany(chequesRaw        ?? []), [chequesRaw, filterByCompany]);
  const bankAccounts   = useMemo(() => filterByCompany(bankAccountsRaw   ?? []), [bankAccountsRaw, filterByCompany]);
  const journalEntries = useMemo(() => filterByCompany(journalEntriesRaw ?? []), [journalEntriesRaw, filterByCompany]);
  const chartOfAccts   = useMemo(() => filterByCompany(chartOfAccountsRaw ?? []), [chartOfAccountsRaw, filterByCompany]);
  const deliveryNotes  = useMemo(() => filterByCompany(deliveryNotesRaw   ?? []), [deliveryNotesRaw, filterByCompany]);

  // ===== Receivables KPIs =====
  const totalRevenue       = invoices.reduce((s, i) => s + (i.grandTotal ?? 0), 0);
  const totalCollected     = invoices.reduce((s, i) => s + (i.amountPaid ?? 0), 0);
  const outstandingAR      = invoices.reduce((s, i) => s + ((i.balance ?? Math.max(0, (i.grandTotal ?? 0) - (i.amountPaid ?? 0)))), 0);
  const overdueInvoices    = invoices.filter(i => (i.paymentStatus !== "paid") && daysSince(i.invoiceDate) > 30);
  const overdueAmount      = overdueInvoices.reduce((s, i) => s + ((i.balance ?? Math.max(0, (i.grandTotal ?? 0) - (i.amountPaid ?? 0)))), 0);

  // ===== Cash In / Out =====
  const cashIn30d  = paymentsRec.filter(p => daysSince(p.paymentDate) <= 30).reduce((s, p) => s + (p.amount ?? 0), 0);
  const cashOut30d = paymentsMade.filter(p => daysSince(p.paymentDate) <= 30).reduce((s, p) => s + (p.amount ?? 0), 0);
  const netCashFlow30d = cashIn30d - cashOut30d;

  // ===== Expenses =====
  const totalExpenses    = expenses.reduce((s, e) => s + (e.total ?? 0), 0);
  const pendingExpenses  = expenses.filter(e => e.status === "pending" || e.status === "draft");
  const pendingExpVal    = pendingExpenses.reduce((s, e) => s + (e.total ?? 0), 0);

  // ===== Cheques =====
  const pendingCheques  = cheques.filter(c => c.status !== "cleared" && c.status !== "cancelled" && c.status !== "bounced");
  const pendingChqValue = pendingCheques.reduce((s, c) => s + (c.amount ?? 0), 0);

  // ===== Cheques due soon (HIGH ALERT) — issued cheques within the next 7 days =====
  // Compare WHOLE CALENDAR DAYS in the user's local timezone. Using raw timestamps
  // makes "today" flip to "1d left" depending on wall-clock time-of-day.
  const chequesDueSoon = useMemo(() => {
    const todayLocal = localDayMs(new Date());
    return pendingCheques
      .map(c => {
        const chqLocal = localDayMs(c.chequeDate);
        const daysUntil = isFinite(chqLocal) ? Math.round((chqLocal - todayLocal) / 86_400_000) : NaN;
        return { ...c, _ts: chqLocal, _daysUntil: daysUntil };
      })
      .filter(c => isFinite(c._ts) && c._daysUntil <= 7)
      .sort((a, b) => a._ts - b._ts);
  }, [pendingCheques]);
  const chequesOverdue = chequesDueSoon.filter(c => c._daysUntil < 0);
  const chequesDueValue = chequesDueSoon.reduce((s, c) => s + (c.amount ?? 0), 0);

  // ===== Delivery Notes =====
  const pendingDeliveryNotes = deliveryNotes.filter(d => d.status !== "delivered" && d.status !== "cancelled");
  const dnSpark = weeklyCounts(deliveryNotes, "createdAt", 8);
  const dnTrend = trendPct(dnSpark);

  // ===== UAE FTA — VAT @ 5% (Output - Input) =====
  const VAT_RATE = 0.05;
  const vatOutput = invoices.reduce((s, i) => s + (i.vatAmount ?? 0), 0);
  const vatInput  = expenses.reduce((s, e) => s + (e.vatAmount ?? 0), 0);
  const vatPayable = vatOutput - vatInput;
  const totalSubtotal = invoices.reduce((s, i) => s + (i.subtotal ?? Math.max(0, (i.grandTotal ?? 0) - (i.vatAmount ?? 0))), 0);

  // ===== UAE Corporate Tax @ 9% (above AED 375,000 threshold) =====
  const CT_RATE = 0.09;
  const CT_THRESHOLD = 375_000;
  const expensesNetVat = expenses.reduce((s, e) => s + Math.max(0, (e.total ?? 0) - (e.vatAmount ?? 0)), 0);
  const taxableProfit = Math.max(0, totalSubtotal - expensesNetVat);
  const ctTaxableAmount = Math.max(0, taxableProfit - CT_THRESHOLD);
  const ctEstimated = ctTaxableAmount * CT_RATE;

  // ===== Sparklines =====
  const invSpark    = weeklyCounts(invoices, "createdAt", 8);
  const invValSpark = weeklyValues(invoices, "createdAt", (i: any) => Number(i.grandTotal ?? 0), 8);
  const cashInSpark  = weeklyValues(paymentsRec, "paymentDate", (p: any) => Number(p.amount ?? 0), 8);
  const cashOutSpark = weeklyValues(paymentsMade, "paymentDate", (p: any) => Number(p.amount ?? 0), 8);
  const expSpark    = weeklyValues(expenses, "createdAt", (e: any) => Number(e.total ?? 0), 8);
  const chqSpark    = weeklyCounts(cheques, "createdAt", 8);

  const revTrend     = trendPct(invValSpark);
  const cashInTrend  = trendPct(cashInSpark);
  const cashOutTrend = trendPct(cashOutSpark);
  const expTrend     = trendPct(expSpark);

  // ===== Cash Flow 30-day chart (O(N+30) via pre-grouped maps) =====
  const cashFlow30d = useMemo(() => {
    const inMap = new Map<string, number>();
    const outMap = new Map<string, number>();
    for (const p of paymentsRec) {
      const k = localDayKey(p.paymentDate);
      if (k) inMap.set(k, (inMap.get(k) ?? 0) + (p.amount ?? 0));
    }
    for (const p of paymentsMade) {
      const k = localDayKey(p.paymentDate);
      if (k) outMap.set(k, (outMap.get(k) ?? 0) + (p.amount ?? 0));
    }
    const days: { day: string; in: number; out: number; net: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = localDayKey(d) ?? "";
      const inDay = inMap.get(key) ?? 0;
      const outDay = outMap.get(key) ?? 0;
      days.push({
        day: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
        in: Math.round(inDay),
        out: Math.round(outDay),
        net: Math.round(inDay - outDay),
      });
    }
    return days;
  }, [paymentsRec, paymentsMade]);

  // ===== Invoice status breakdown =====
  const invByStatus = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    invoices.forEach(i => {
      const k = i.paymentStatus || "unpaid";
      if (!map[k]) map[k] = { count: 0, value: 0 };
      map[k].count += 1;
      map[k].value += (i.grandTotal ?? 0);
    });
    return Object.entries(map).map(([name, v]) => ({ name, count: v.count, value: Math.round(v.value) }));
  }, [invoices]);

  // ===== Expenses by category =====
  const expByCategory = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    expenses.forEach(e => {
      const k = e.category || "Uncategorized";
      if (!map[k]) map[k] = { count: 0, value: 0 };
      map[k].count += 1;
      map[k].value += (e.total ?? 0);
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, count: v.count, value: Math.round(v.value) }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // ===== Top customers (by invoiced revenue) =====
  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; invoiced: number; collected: number; outstanding: number; count: number }>();
    invoices.forEach(i => {
      const name = i.clientName || "Unknown";
      const cur = map.get(name) ?? { name, invoiced: 0, collected: 0, outstanding: 0, count: 0 };
      cur.invoiced += (i.grandTotal ?? 0);
      cur.collected += (i.amountPaid ?? 0);
      cur.outstanding += (i.balance ?? Math.max(0, (i.grandTotal ?? 0) - (i.amountPaid ?? 0)));
      cur.count += 1;
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.invoiced - a.invoiced).slice(0, 6);
  }, [invoices]);

  // ===== Top suppliers / payees (by expenses + payments made) =====
  const topPayees = useMemo(() => {
    const map = new Map<string, { name: string; spent: number; count: number }>();
    expenses.forEach(e => {
      const name = e.supplierName || "Other";
      const cur = map.get(name) ?? { name, spent: 0, count: 0 };
      cur.spent += (e.total ?? 0); cur.count += 1;
      map.set(name, cur);
    });
    paymentsMade.forEach(p => {
      const name = p.payeeName || "Other";
      const cur = map.get(name) ?? { name, spent: 0, count: 0 };
      cur.spent += (p.amount ?? 0); cur.count += 1;
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent).slice(0, 6);
  }, [expenses, paymentsMade]);

  // ===== Outstanding invoices (oldest unpaid first) =====
  const outstandingInvoices = useMemo(() => {
    return invoices
      .filter(i => i.paymentStatus !== "paid" && (i.balance ?? Math.max(0, (i.grandTotal ?? 0) - (i.amountPaid ?? 0))) > 0)
      .sort((a, b) => new Date(a.invoiceDate ?? a.createdAt).getTime() - new Date(b.invoiceDate ?? b.createdAt).getTime())
      .slice(0, 7)
      .map(i => ({
        ...i,
        daysOpen: daysSince(i.invoiceDate ?? i.createdAt),
        balanceDue: i.balance ?? Math.max(0, (i.grandTotal ?? 0) - (i.amountPaid ?? 0)),
      }));
  }, [invoices]);

  // ===== Recent transactions (mix of payments rec + made) =====
  const recentTransactions = useMemo(() => {
    type Tx = { id: string; date: string; party: string; ref: string; amount: number; method: string; type: "in" | "out" };
    const list: Tx[] = [
      ...paymentsRec.map(p => ({
        id: `r-${p.id}`,
        date: p.paymentDate,
        party: p.customerName,
        ref:   p.paymentNumber,
        amount: p.amount ?? 0,
        method: p.paymentMethod ?? "—",
        type: "in" as const,
      })),
      ...paymentsMade.map(p => ({
        id: `m-${p.id}`,
        date: p.paymentDate,
        party: p.payeeName,
        ref:   p.paymentNumber,
        amount: p.amount ?? 0,
        method: p.paymentMethod ?? "—",
        type: "out" as const,
      })),
    ];
    return list
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [paymentsRec, paymentsMade]);

  // ===== Cheques status =====
  const chqByStatus = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    cheques.forEach(c => {
      const k = c.status || "issued";
      if (!map[k]) map[k] = { count: 0, value: 0 };
      map[k].count += 1;
      map[k].value += (c.amount ?? 0);
    });
    return Object.entries(map).map(([name, v]) => ({ name, count: v.count, value: Math.round(v.value) }));
  }, [cheques]);

  // ===== AI Insights =====
  const insights: { tone: "red" | "amber" | "blue" | "green"; text: string; cta?: { href: string; label: string } }[] = [];
  if (chequesDueSoon.length > 0) {
    insights.push({
      tone: "red",
      text: `${chequesDueSoon.length} cheque${chequesDueSoon.length > 1 ? "s" : ""} due within 7 days · ${fmtAED(chequesDueValue)} — ensure bank balance is funded`,
      cta: { href: "/accounts/cheques", label: "Open cheques" },
    });
  }
  if (overdueInvoices.length > 0) {
    insights.push({
      tone: "red",
      text: `${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? "s" : ""} overdue 30+ days · ${fmtAED(overdueAmount)} at risk`,
      cta: { href: "/accounts/invoices", label: "Chase now" },
    });
  }
  if (pendingCheques.length > 0) {
    insights.push({
      tone: "amber",
      text: `${pendingCheques.length} cheque${pendingCheques.length > 1 ? "s" : ""} pending clearance · ${fmtAED(pendingChqValue)}`,
      cta: { href: "/accounts/cheques", label: "Review" },
    });
  }
  if (pendingExpenses.length > 0) {
    insights.push({
      tone: "blue",
      text: `${pendingExpenses.length} expense${pendingExpenses.length > 1 ? "s" : ""} awaiting approval · ${fmtAED(pendingExpVal)}`,
      cta: { href: "/accounts/expenses", label: "Approve" },
    });
  }
  if (vatPayable > 0) {
    insights.push({
      tone: "amber",
      text: `Estimated VAT payable: ${fmtAED(vatPayable)} (output ${fmtAED(vatOutput)} − input ${fmtAED(vatInput)})`,
      cta: { href: "/accounts/vat-report", label: "VAT Report" },
    });
  }
  if (netCashFlow30d > 0) {
    insights.push({
      tone: "green",
      text: `Positive cash flow last 30 days: +${fmtAED(netCashFlow30d)} net (in ${fmtAED(cashIn30d)} / out ${fmtAED(cashOut30d)})`,
    });
  } else if (netCashFlow30d < 0) {
    insights.push({
      tone: "red",
      text: `Negative cash flow last 30 days: ${fmtAED(netCashFlow30d)} net — reduce outflows or accelerate collections`,
    });
  }
  if (insights.length === 0) {
    insights.push({ tone: "green", text: "All accounting KPIs are healthy — no immediate actions required" });
  }

  if (invLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading accounts dashboard…</div>;
  }

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button asChild size="sm" className="bg-white text-[#0f2d5a] hover:bg-white/90 h-8">
        <Link href="/accounts/invoices"><Plus className="w-3.5 h-3.5 mr-1.5" />Invoice</Link>
      </Button>
      <Button asChild size="sm" variant="outline" className="bg-white/15 hover:bg-white/25 border-white/20 text-white h-8">
        <Link href="/accounts/payments-received"><Plus className="w-3.5 h-3.5 mr-1.5" />Payment In</Link>
      </Button>
      <Button asChild size="sm" variant="outline" className="bg-white/15 hover:bg-white/25 border-white/20 text-white h-8">
        <Link href="/accounts/payments-made"><Plus className="w-3.5 h-3.5 mr-1.5" />Payment Out</Link>
      </Button>
      <Button asChild size="sm" variant="outline" className="bg-white/15 hover:bg-white/25 border-white/20 text-white h-8">
        <Link href="/accounts/expenses"><Plus className="w-3.5 h-3.5 mr-1.5" />Expense</Link>
      </Button>
      <Button asChild size="sm" variant="outline" className="bg-white/15 hover:bg-white/25 border-white/20 text-white h-8">
        <Link href="/accounts/delivery-notes"><Plus className="w-3.5 h-3.5 mr-1.5" />Delivery Note</Link>
      </Button>
    </div>
  );

  return (
    <div className="space-y-5 pb-8">
      <ExecutiveHeader
        icon={Wallet}
        title="Accounts Command Center"
        subtitle="Live view of receivables, payables, cash flow and ledger across all companies"
      >
        {headerActions}
      </ExecutiveHeader>

      {/* HIGH ALERT — Cheques due / overdue (only renders when relevant) */}
      {chequesDueSoon.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-red-400 dark:border-red-700 bg-gradient-to-r from-red-50 via-red-50 to-orange-50 dark:from-red-950/40 dark:via-red-950/30 dark:to-orange-950/30 shadow-lg">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-red-600 to-red-700 animate-pulse" />
          <div className="p-4 pl-5">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <BellRing className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-red-700 dark:text-red-300 uppercase tracking-wide">
                    High Alert — Cheques due soon
                  </div>
                  <div className="text-xs text-red-700/80 dark:text-red-300/80">
                    {chequesDueSoon.length} cheque{chequesDueSoon.length > 1 ? "s" : ""} payable in next 7 days
                    {chequesOverdue.length > 0 && <span className="font-semibold"> · {chequesOverdue.length} already past date</span>}
                    {" · total "}
                    <span className="font-bold">{fmtAED(chequesDueValue)}</span>
                  </div>
                </div>
              </div>
              <Button asChild size="sm" className="bg-red-600 hover:bg-red-700 text-white h-8 shrink-0">
                <Link href="/accounts/cheques"><AlertTriangle className="w-3.5 h-3.5 mr-1.5" />Open cheques register</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {chequesDueSoon.slice(0, 6).map(c => {
                const isOverdue = c._daysUntil < 0;
                const isToday = c._daysUntil === 0;
                const urgencyText = isOverdue
                  ? `OVERDUE ${Math.abs(c._daysUntil)}d`
                  : isToday
                  ? "DUE TODAY"
                  : `${c._daysUntil}d left`;
                const urgencyClass = isOverdue
                  ? "bg-red-600 text-white"
                  : isToday
                  ? "bg-red-500 text-white animate-pulse"
                  : c._daysUntil <= 2
                  ? "bg-orange-500 text-white"
                  : "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
                return (
                  <div key={c.id} className="rounded-lg bg-white dark:bg-card border border-red-200 dark:border-red-900/60 p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-foreground truncate">
                          {c.payeeName || "Unnamed payee"}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          Cheque #{c.chequeNumber} · {c.bankName ?? "—"}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${urgencyClass}`}>
                        {urgencyText}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/40">
                      <span className="text-[10px] text-muted-foreground">{c.chequeDate}</span>
                      <span className="text-sm font-bold tabular-nums text-red-700 dark:text-red-400">{fmtAED(c.amount ?? 0)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {chequesDueSoon.length > 6 && (
              <div className="mt-2 text-[11px] text-red-700/80 dark:text-red-300/80 text-center">
                +{chequesDueSoon.length - 6} more cheque{chequesDueSoon.length - 6 > 1 ? "s" : ""} due in the next 7 days — see register for full list
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${activeCompanyId === 2 ? "from-[#0D0D0D] to-[#8B0000]" : "from-[#0f2d5a] to-[#1e6ab0]"}`} />
        <div className="p-4 pl-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0f2d5a]/5 text-[#0f2d5a] dark:bg-[#1e6ab0]/15 dark:text-[#7eb9f0]">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">AI Accounts Insights</span>
            </div>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              live
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {insights.slice(0, 6).map((ins, i) => {
              const toneClass = ins.tone === "red"
                ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900 text-red-700 dark:text-red-400"
                : ins.tone === "amber"
                ? "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900 text-orange-700 dark:text-orange-400"
                : ins.tone === "green"
                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400"
                : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900 text-blue-700 dark:text-blue-400";
              return (
                <div key={i} className={`flex items-start justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${toneClass}`}>
                  <span>{ins.text}</span>
                  {ins.cta && (
                    <Button asChild variant="ghost" size="sm" className="h-6 px-2 text-[11px] shrink-0">
                      <Link href={ins.cta.href}>{ins.cta.label}</Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Strip - 8 widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIWidget
          tone="navy" icon={Receipt} label="Total Revenue" value={fmtAED(totalRevenue)}
          sub={`${invoices.length} invoices`} sparkline={invValSpark} trend={revTrend}
          href="/accounts/invoices"
        />
        <KPIWidget
          tone="amber" icon={Clock} label="Outstanding A/R" value={fmtAED(outstandingAR)}
          sub={`Collected ${fmtAED(totalCollected)}`} sparkline={invSpark}
          href="/accounts/invoices"
        />
        <KPIWidget
          tone="green" icon={ArrowDownCircle} label="Cash In (30d)" value={fmtAED(cashIn30d)}
          sub={`${paymentsRec.length} receipts total`} sparkline={cashInSpark} trend={cashInTrend}
          href="/accounts/payments-received"
        />
        <KPIWidget
          tone="red" icon={ArrowUpCircle} label="Cash Out (30d)" value={fmtAED(cashOut30d)}
          sub={`${paymentsMade.length} payments total`} sparkline={cashOutSpark} trend={cashOutTrend}
          href="/accounts/payments-made"
        />
        <KPIWidget
          tone="purple" icon={Banknote} label="Total Expenses" value={fmtAED(totalExpenses)}
          sub={`${expenses.length} entries`} sparkline={expSpark} trend={expTrend}
          href="/accounts/expenses"
        />
        <KPIWidget
          tone="indigo" icon={FileBox} label="Pending Cheques" value={fmtNum(pendingCheques.length)}
          sub={fmtAED(pendingChqValue)} sparkline={chqSpark}
          href="/accounts/cheques"
        />
        <KPIWidget
          tone="teal" icon={Truck} label="Delivery Notes" value={fmtNum(deliveryNotes.length)}
          sub={`${pendingDeliveryNotes.length} pending`} sparkline={dnSpark} trend={dnTrend}
          href="/accounts/delivery-notes"
        />
        <KPIWidget
          tone="blue" icon={PieIcon} label="VAT Payable (5%)" value={fmtAED(Math.max(0, vatPayable))}
          sub={`Out ${fmtAED(vatOutput)} − In ${fmtAED(vatInput)}`}
          href="/accounts/vat-report"
        />
      </div>

      {/* Cash Flow 30d + Invoice status donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PremiumCard className="lg:col-span-2">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#1e6ab0]" />
                  Cash Flow — Last 30 Days
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Daily money in vs out · net {fmtAED(netCashFlow30d)}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />In</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" />Out</span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlow30d}>
                  <defs>
                    <linearGradient id="cashInGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cashOutGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(cashFlow30d.length / 8) - 1)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip
                    formatter={(v: any) => fmtAED(Number(v))}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="in" stroke="#10b981" strokeWidth={2} fill="url(#cashInGrad)" />
                  <Area type="monotone" dataKey="out" stroke="#ef4444" strokeWidth={2} fill="url(#cashOutGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard tone="navy" className="text-white">
          <div className="p-5">
            <div className="text-sm font-semibold flex items-center gap-2 text-white">
              <Receipt className="w-4 h-4" />
              Invoices by Status
            </div>
            <div className="text-[11px] text-white/70 mt-0.5">{fmtAED(totalRevenue)} total invoiced</div>
            <div className="h-48 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={invByStatus} dataKey="value" nameKey="name"
                    innerRadius={42} outerRadius={70} paddingAngle={2}
                  >
                    {invByStatus.map((s, i) => (
                      <Cell key={i} fill={STATUS_COLORS[s.name] ?? categoryPalette[i % categoryPalette.length]} stroke="rgba(255,255,255,0.2)" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => fmtAED(Number(v))}
                    contentStyle={{ background: "rgba(15, 45, 90, 0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11, color: "white" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1">
              {invByStatus.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-[11px] gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: STATUS_COLORS[s.name] ?? "#94a3b8" }} />
                    <span className="truncate capitalize">{s.name.replace(/_/g, " ")}</span>
                    <span className="text-white/50 text-[10px]">×{s.count}</span>
                  </div>
                  <span className="tabular-nums font-medium shrink-0">{fmtAED(s.value)}</span>
                </div>
              ))}
              {invByStatus.length === 0 && <div className="text-white/60 text-[11px] italic">No invoices yet</div>}
            </div>
          </div>
        </PremiumCard>
      </div>

      {/* Outstanding invoices + Cheques status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PremiumCard tone="amber" className="lg:col-span-2">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <FileWarning className="w-4 h-4 text-orange-700" />
                Outstanding Invoices — Oldest First
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-[11px]">
                <Link href="/accounts/invoices">View all</Link>
              </Button>
            </div>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase text-muted-foreground tracking-wide">
                  <tr className="border-b border-border/60">
                    <th className="text-left px-2 py-2 font-medium">Invoice</th>
                    <th className="text-left px-2 py-2 font-medium">Client</th>
                    <th className="text-left px-2 py-2 font-medium">Date</th>
                    <th className="text-right px-2 py-2 font-medium">Total</th>
                    <th className="text-right px-2 py-2 font-medium">Balance</th>
                    <th className="text-right px-2 py-2 font-medium">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingInvoices.map(i => (
                    <tr key={i.id} className="border-b border-border/30 hover:bg-orange-50/40 dark:hover:bg-orange-950/20 transition-colors">
                      <td className="px-2 py-2">
                        <Link href={`/accounts/invoices/${i.id}`} className="text-[#1e6ab0] font-medium hover:underline">
                          {i.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-2 py-2 truncate max-w-[160px]">{i.clientName}</td>
                      <td className="px-2 py-2 text-muted-foreground">{i.invoiceDate ?? "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmtAED(i.grandTotal ?? 0)}</td>
                      <td className="px-2 py-2 text-right tabular-nums font-semibold text-orange-700">{fmtAED(i.balanceDue)}</td>
                      <td className="px-2 py-2 text-right">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${i.daysOpen > 60 ? "bg-red-100 text-red-700" : i.daysOpen > 30 ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                          {i.daysOpen}d
                        </span>
                      </td>
                    </tr>
                  ))}
                  {outstandingInvoices.length === 0 && (
                    <tr><td colSpan={6} className="px-2 py-6 text-center text-muted-foreground italic text-[11px]">No outstanding invoices — fully collected</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard>
          <div className="p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileBox className="w-4 h-4 text-indigo-600" />
                Cheques by Status
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-[11px]">
                <Link href="/accounts/cheques">All cheques</Link>
              </Button>
            </div>
            <div className="text-xs text-foreground/70 font-medium">
              <span className="tabular-nums">{cheques.length}</span> cheques ·
              <span className="font-bold text-foreground ml-1">{fmtAED(cheques.reduce((s, c) => s + (c.amount ?? 0), 0))}</span>
            </div>
            <div className="mt-4 space-y-3">
              {chqByStatus.map(s => {
                const total = cheques.length || 1;
                const pct = Math.round((s.count / total) * 100);
                const color = STATUS_COLORS[s.name] ?? "#94a3b8";
                return (
                  <div key={s.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="capitalize font-bold text-foreground flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
                        {s.name}
                      </span>
                      <span className="tabular-nums text-foreground font-semibold">
                        <span className="text-foreground/70 font-normal mr-1">{s.count} ×</span>
                        {fmtAED(s.value)}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-foreground/10 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
              {chqByStatus.length === 0 && <div className="text-muted-foreground text-xs italic py-2">No cheques recorded</div>}
            </div>
          </div>
        </PremiumCard>
      </div>

      {/* UAE FTA Tax Compliance — VAT (5%) + Corporate Tax (9%) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* VAT Card */}
        <PremiumCard tone="blue">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">UAE VAT (5%)</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">FTA Compliant · Output minus Input</div>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-[11px]">
                <Link href="/accounts/vat-report">VAT Report</Link>
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-lg bg-white dark:bg-card/40 border border-border/40 p-2.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Output VAT</div>
                <div className="text-sm font-bold text-foreground tabular-nums mt-1">{fmtAED(vatOutput)}</div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">collected on sales</div>
              </div>
              <div className="rounded-lg bg-white dark:bg-card/40 border border-border/40 p-2.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Input VAT</div>
                <div className="text-sm font-bold text-foreground tabular-nums mt-1">{fmtAED(vatInput)}</div>
                <div className="text-[10px] text-blue-700 dark:text-blue-400 font-medium mt-0.5">recoverable on costs</div>
              </div>
              <div className={`rounded-lg p-2.5 border ${vatPayable >= 0 ? "bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800" : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"}`}>
                <div className={`text-[10px] uppercase tracking-wide font-semibold ${vatPayable >= 0 ? "text-orange-800 dark:text-orange-300" : "text-emerald-800 dark:text-emerald-300"}`}>
                  {vatPayable >= 0 ? "Net Payable" : "Refundable"}
                </div>
                <div className={`text-sm font-bold tabular-nums mt-1 ${vatPayable >= 0 ? "text-orange-900 dark:text-orange-200" : "text-emerald-900 dark:text-emerald-200"}`}>
                  {fmtAED(Math.abs(vatPayable))}
                </div>
                <div className={`text-[10px] font-medium mt-0.5 ${vatPayable >= 0 ? "text-orange-700 dark:text-orange-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                  {vatPayable >= 0 ? "due to FTA" : "claim from FTA"}
                </div>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground leading-relaxed pl-1 border-l-2 border-blue-300 dark:border-blue-800">
              <span className="font-semibold text-foreground">Standard rate {(VAT_RATE * 100).toFixed(0)}%</span> · returns due quarterly via the FTA EmaraTax portal · taxable supplies of {fmtAED(totalSubtotal)} (excluding VAT)
            </div>
          </div>
        </PremiumCard>

        {/* Corporate Tax Card */}
        <PremiumCard tone="purple">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 text-white flex items-center justify-center shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">UAE Corporate Tax (9%)</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Above AED 375,000 threshold</div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded bg-purple-200 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200">
                YTD ESTIMATE
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-lg bg-white dark:bg-card/40 border border-border/40 p-2.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Taxable Income</div>
                <div className="text-sm font-bold text-foreground tabular-nums mt-1">{fmtAED(taxableProfit)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Revenue − Expenses (net of VAT)</div>
              </div>
              <div className="rounded-lg bg-white dark:bg-card/40 border border-border/40 p-2.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Threshold</div>
                <div className="text-sm font-bold text-foreground tabular-nums mt-1">{fmtAED(CT_THRESHOLD)}</div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">0% rate up to this amount</div>
              </div>
              <div className="rounded-lg bg-white dark:bg-card/40 border border-border/40 p-2.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Above Threshold</div>
                <div className="text-sm font-bold text-foreground tabular-nums mt-1">{fmtAED(ctTaxableAmount)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">subject to {(CT_RATE * 100).toFixed(0)}% CT</div>
              </div>
              <div className={`rounded-lg p-2.5 border ${ctEstimated > 0 ? "bg-purple-100 dark:bg-purple-950/60 border-purple-300 dark:border-purple-700" : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"}`}>
                <div className={`text-[10px] uppercase tracking-wide font-semibold ${ctEstimated > 0 ? "text-purple-800 dark:text-purple-300" : "text-emerald-800 dark:text-emerald-300"}`}>
                  CT Estimated
                </div>
                <div className={`text-sm font-bold tabular-nums mt-1 ${ctEstimated > 0 ? "text-purple-900 dark:text-purple-200" : "text-emerald-900 dark:text-emerald-200"}`}>
                  {fmtAED(ctEstimated)}
                </div>
                <div className={`text-[10px] font-medium mt-0.5 ${ctEstimated > 0 ? "text-purple-700 dark:text-purple-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                  {ctEstimated > 0 ? "annual CT liability" : "below threshold"}
                </div>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground leading-relaxed pl-1 border-l-2 border-purple-300 dark:border-purple-800">
              <span className="font-semibold text-foreground">FTA CT Law (Federal Decree-Law No. 47 of 2022)</span> · effective from FYs starting on or after 1 June 2023 · figure shown is <span className="font-semibold text-foreground">year-to-date</span> profit vs the AED 375,000 annual threshold — full-year liability will be higher if YTD profit grows · final amount depends on accounting adjustments, exempt income &amp; reliefs (Small Business Relief, Free Zone, etc.)
            </div>
          </div>
        </PremiumCard>
      </div>

      {/* Top Customers + Top Payees */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PremiumCard tone="green">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-700" />
                Top Customers (by revenue)
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-[11px]">
                <Link href="/accounts/payments-received">Receipts</Link>
              </Button>
            </div>
            <div className="space-y-2">
              {topCustomers.map((c, i) => {
                const pctCollected = c.invoiced > 0 ? Math.round((c.collected / c.invoiced) * 100) : 0;
                return (
                  <div key={c.name} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium truncate">{c.name}</span>
                        <span className="tabular-nums font-semibold shrink-0">{fmtAED(c.invoiced)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden flex-1">
                          <div className="h-full bg-emerald-500" style={{ width: `${pctCollected}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{pctCollected}% collected</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{c.count} invoice{c.count > 1 ? "s" : ""} · {fmtAED(c.outstanding)} outstanding</div>
                    </div>
                  </div>
                );
              })}
              {topCustomers.length === 0 && <div className="text-muted-foreground text-xs italic text-center py-4">No customer data</div>}
            </div>
          </div>
        </PremiumCard>

        <PremiumCard tone="red">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-red-700" />
                Top Payees (by spend)
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-[11px]">
                <Link href="/accounts/payments-made">Payments</Link>
              </Button>
            </div>
            <div className="space-y-2">
              {topPayees.map((p, i) => {
                const max = topPayees[0]?.spent || 1;
                const pct = Math.round((p.spent / max) * 100);
                return (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium truncate">{p.name}</span>
                        <span className="tabular-nums font-semibold shrink-0">{fmtAED(p.spent)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden flex-1">
                          <div className="h-full bg-red-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{p.count} txn{p.count > 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {topPayees.length === 0 && <div className="text-muted-foreground text-xs italic text-center py-4">No payee data</div>}
            </div>
          </div>
        </PremiumCard>
      </div>

      {/* Expenses by category + Recent transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PremiumCard tone="purple">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-purple-700" />
                  Expenses by Category
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{fmtAED(totalExpenses)} total</div>
              </div>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expByCategory.slice(0, 8)} dataKey="value" nameKey="name"
                    innerRadius={36} outerRadius={64} paddingAngle={2}
                  >
                    {expByCategory.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={categoryPalette[i % categoryPalette.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => fmtAED(Number(v))}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 space-y-1">
              {expByCategory.slice(0, 5).map((c, i) => (
                <div key={c.name} className="flex items-center justify-between text-[11px] gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: categoryPalette[i % categoryPalette.length] }} />
                    <span className="truncate capitalize">{c.name.replace(/_/g, " ")}</span>
                  </div>
                  <span className="tabular-nums font-medium shrink-0">{fmtAED(c.value)}</span>
                </div>
              ))}
              {expByCategory.length === 0 && <div className="text-muted-foreground text-[11px] italic">No expenses yet</div>}
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="lg:col-span-2">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#1e6ab0]" />
                Recent Transactions
              </div>
              <div className="text-[11px] text-muted-foreground">Last 8 movements</div>
            </div>
            <div className="space-y-2">
              {recentTransactions.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tx.type === "in" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {tx.type === "in" ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">{tx.party}</span>
                      <span className={`text-xs font-semibold tabular-nums shrink-0 ${tx.type === "in" ? "text-emerald-700" : "text-red-700"}`}>
                        {tx.type === "in" ? "+" : "−"}{fmtAED(tx.amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {tx.ref} · <span className="capitalize">{tx.method.replace(/_/g, " ")}</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{tx.date}</span>
                    </div>
                  </div>
                </div>
              ))}
              {recentTransactions.length === 0 && <div className="text-muted-foreground text-xs italic text-center py-6">No recent transactions</div>}
            </div>
          </div>
        </PremiumCard>
      </div>

      {/* Bank accounts + Delivery Notes + Journal entries summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PremiumCard tone="teal">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Landmark className="w-4 h-4 text-teal-700" />
                Bank Accounts ({bankAccounts.length})
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-[11px]">
                <Link href="/accounts/bank-accounts">Manage</Link>
              </Button>
            </div>
            <div className="space-y-2">
              {bankAccounts.slice(0, 6).map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border/50 bg-card/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/15 text-teal-700 flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{a.bankName}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{a.accountName} · {a.accountNumber}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-muted-foreground uppercase">{a.currency ?? "AED"}</div>
                    <div className={`text-[10px] font-semibold ${a.isActive ? "text-emerald-700" : "text-slate-500"}`}>
                      {a.isActive ? "Active" : "Inactive"}
                    </div>
                  </div>
                </div>
              ))}
              {bankAccounts.length === 0 && <div className="text-muted-foreground text-xs italic text-center py-4">No bank accounts yet</div>}
            </div>
          </div>
        </PremiumCard>

        {/* Recent Delivery Notes */}
        <PremiumCard tone="amber">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Truck className="w-4 h-4 text-orange-700" />
                Recent Delivery Notes ({deliveryNotes.length})
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-[11px]">
                <Link href="/accounts/delivery-notes">View all</Link>
              </Button>
            </div>
            <div className="space-y-2">
              {[...deliveryNotes]
                .sort((a, b) => new Date((b.deliveryDate ?? b.createdAt) as any).getTime() - new Date((a.deliveryDate ?? a.createdAt) as any).getTime())
                .slice(0, 6)
                .map(d => {
                  const status = (d.status ?? "draft").toLowerCase();
                  const statusClass =
                    status === "delivered" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" :
                    status === "in_transit" || status === "dispatched" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                    status === "cancelled" ? "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300" :
                    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
                  return (
                    <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border/50 bg-card/40">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{d.dnNumber}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${statusClass}`}>
                            {status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">{d.clientName ?? "—"}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-muted-foreground">{d.deliveryDate ?? "—"}</div>
                      </div>
                    </div>
                  );
                })}
              {deliveryNotes.length === 0 && <div className="text-muted-foreground text-xs italic text-center py-4">No delivery notes yet</div>}
            </div>
          </div>
        </PremiumCard>

        <PremiumCard tone="slate">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-slate-700" />
                Recent Journal Entries
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-[11px]">
                <Link href="/accounts/journal-entries">View all</Link>
              </Button>
            </div>
            <div className="space-y-2">
              {[...journalEntries]
                .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
                .slice(0, 6)
                .map(j => (
                <div key={j.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border/50 bg-card/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{j.journalNumber}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${
                        j.status === "posted" ? "bg-emerald-100 text-emerald-700" :
                        j.status === "approved" ? "bg-blue-100 text-blue-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>{j.status}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5">{j.description || j.reference || "—"}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold tabular-nums">{fmtAED(j.totalDebit ?? 0)}</div>
                    <div className="text-[10px] text-muted-foreground">{j.entryDate}</div>
                  </div>
                </div>
              ))}
              {journalEntries.length === 0 && <div className="text-muted-foreground text-xs italic text-center py-4">No journal entries yet</div>}
            </div>
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
