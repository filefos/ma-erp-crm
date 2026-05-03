import { useMemo } from "react";
import { Link } from "wouter";
import {
  useListQuotations, useListProformaInvoices, useListLpos, useListDeals, useListLeads,
  useListUsers, useListSalesTargets, useListTaxInvoices, useListPaymentsReceived,
} from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, AreaChart, Area, PieChart as RPieChart, Pie, Cell,
} from "recharts";
import {
  FileText, FileCheck, ClipboardList, Trophy, Target, Users, ArrowRight,
  TrendingUp, Sparkles, ShoppingBag, Receipt, Briefcase, Crown, Calendar,
} from "lucide-react";
import {
  ExecutiveHeader, KPIWidget, StatusBadge, Avatar, PremiumCard, Sparkline,
  weeklyCounts, weeklyValues, trendPct,
} from "@/components/crm/premium";

const PALETTE = ["#0f2d5a", "#1e6ab0", "#3b82f6", "#10b981", "#f97316", "#8b5cf6", "#14b8a6", "#ef4444"];

function fmtAED(v: number): string {
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `AED ${(v / 1_000).toFixed(0)}k`;
  return `AED ${Math.round(v).toLocaleString()}`;
}

export function SalesDashboard() {
  const { filterByCompany } = useActiveCompany();
  const now = new Date();
  const year = now.getFullYear();

  const { data: quotationsRaw } = useListQuotations();
  const { data: proformaRaw }   = useListProformaInvoices();
  const { data: lposRaw }       = useListLpos();
  const { data: dealsRaw }      = useListDeals();
  const { data: leadsRaw }      = useListLeads({});
  const { data: usersRaw }      = useListUsers();
  const { data: targetsRaw }    = useListSalesTargets({ year });
  const { data: invoicesRaw }   = useListTaxInvoices();
  const { data: paymentsRaw }   = useListPaymentsReceived();

  const quotations = useMemo(() => filterByCompany(quotationsRaw ?? []), [quotationsRaw, filterByCompany]);
  const proformas  = useMemo(() => filterByCompany(proformaRaw  ?? []), [proformaRaw,  filterByCompany]);
  const lpos       = useMemo(() => filterByCompany(lposRaw      ?? []), [lposRaw,      filterByCompany]);
  const deals      = useMemo(() => filterByCompany(dealsRaw     ?? []), [dealsRaw,     filterByCompany]);
  const leads      = useMemo(() => filterByCompany(leadsRaw     ?? []), [leadsRaw,     filterByCompany]);
  const targets    = useMemo(() => filterByCompany(targetsRaw   ?? []), [targetsRaw,   filterByCompany]);
  const invoices   = useMemo(() => filterByCompany(invoicesRaw  ?? []), [invoicesRaw,  filterByCompany]);
  const payments   = useMemo(() => filterByCompany(paymentsRaw  ?? []), [paymentsRaw,  filterByCompany]);
  const users      = useMemo(() => filterByCompany(usersRaw ?? []), [usersRaw, filterByCompany]);

  // ---- KPIs ----
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const quotationsThisMonth = quotations.filter((q: any) => q.createdAt && new Date(q.createdAt) >= monthStart);
  const quotationValue   = quotations.reduce((s: number, q: any) => s + Number(q.grandTotal ?? 0), 0);
  const quotationValueMtd = quotationsThisMonth.reduce((s: number, q: any) => s + Number(q.grandTotal ?? 0), 0);
  const piValue          = proformas.reduce((s: number, p: any) => s + Number(p.total ?? 0), 0);
  const lpoValue         = lpos.reduce((s: number, l: any) => s + Number(l.lpoValue ?? 0), 0);
  const wonDealsValue    = deals.filter((d: any) => d.stage === "won").reduce((s: number, d: any) => s + Number(d.value ?? 0), 0);
  const acceptedQuotes   = quotations.filter((q: any) => ["accepted", "approved", "won"].includes((q.status ?? "").toLowerCase())).length;
  const winRate = quotations.length > 0 ? Math.round((acceptedQuotes / quotations.length) * 100) : 0;

  // ---- Sparklines ----
  const quoteSpark = useMemo(() => weeklyValues(quotations, "createdAt", (q: any) => Number(q.grandTotal ?? 0), 8), [quotations]);
  const piSpark    = useMemo(() => weeklyValues(proformas,  "createdAt", (p: any) => Number(p.total ?? 0), 8), [proformas]);
  const lpoSpark   = useMemo(() => weeklyValues(lpos,       "createdAt", (l: any) => Number(l.lpoValue ?? 0), 8), [lpos]);
  const wonSpark   = useMemo(
    () => weeklyValues(deals.filter((d: any) => d.stage === "won"), "updatedAt", (d: any) => Number(d.value ?? 0), 8),
    [deals],
  );

  // ---- Sales-cycle funnel: Quotation → Proforma → Invoice → Paid ----
  const invoiceTotal = invoices.reduce((s: number, i: any) => s + Number(i.grandTotal ?? i.total ?? 0), 0);
  const paidTotal    = payments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const paidCount    = (() => {
    const paid = new Set<number>();
    for (const p of payments as any[]) if (p.invoiceId != null) paid.add(p.invoiceId);
    return paid.size;
  })();
  const funnelData = useMemo(() => ([
    { stage: "Quotation",    count: quotations.length,                  value: quotationValue },
    { stage: "Proforma Inv", count: proformas.length,                   value: piValue },
    { stage: "Tax Invoice",  count: invoices.length,                    value: invoiceTotal },
    { stage: "Paid",         count: paidCount,                          value: paidTotal },
  ]), [quotations, proformas, invoices, payments, quotationValue, piValue, invoiceTotal, paidTotal, paidCount]);

  // ---- Monthly revenue trend (12 months: quotations vs LPOs) ----
  const monthlyTrend = useMemo(() => {
    const months: { month: string; quotations: number; lpos: number; piValue: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const inRange = (raw?: string) => {
        if (!raw) return false;
        const t = new Date(raw).getTime();
        return t >= d.getTime() && t < next.getTime();
      };
      months.push({
        month: d.toLocaleDateString("en-AE", { month: "short" }),
        quotations: quotations.filter((q: any) => inRange(q.createdAt)).reduce((s: number, q: any) => s + Number(q.grandTotal ?? 0), 0),
        lpos: lpos.filter((l: any) => inRange(l.createdAt ?? l.lpoDate)).reduce((s: number, l: any) => s + Number(l.lpoValue ?? 0), 0),
        piValue: proformas.filter((p: any) => inRange(p.createdAt)).reduce((s: number, p: any) => s + Number(p.total ?? 0), 0),
      });
    }
    return months;
  }, [quotations, lpos, proformas, now]);

  // ---- Quotation status mix ----
  const statusMix = useMemo(() => {
    const m: Record<string, number> = {};
    for (const q of quotations as any[]) {
      const s = (q.status ?? "draft").toLowerCase();
      m[s] = (m[s] ?? 0) + 1;
    }
    return Object.entries(m).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  }, [quotations]);

  // ---- Top clients by quotation value ----
  const topClients = useMemo(() => {
    const m: Record<string, { value: number; count: number; lastDate: string | null; leadId: number | null }> = {};
    for (const q of quotations as any[]) {
      const key = q.clientName ?? "Unknown";
      const e = m[key] ?? { value: 0, count: 0, lastDate: null, leadId: null };
      e.value += Number(q.grandTotal ?? 0);
      e.count += 1;
      const created = q.createdAt ?? null;
      if (created && (!e.lastDate || created > e.lastDate)) e.lastDate = created;
      if (e.leadId == null && q.leadId != null) e.leadId = q.leadId;
      m[key] = e;
    }
    return Object.entries(m)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [quotations]);

  // ---- Top salespeople (by won deals + quotations + projects-via-deals) ----
  const salesUsers = useMemo(() => users.filter((u: any) => {
    const r = (u.role ?? "").toLowerCase();
    return r === "sales" || r.includes("sales") || r === "manager" || r === "main_admin" || r === "admin";
  }), [users]);

  // Single source of truth for salesperson stats — used by both the dedicated
  // Salesperson Performance row and the legacy compact leaderboard panel below.
  const salesPerformance = useMemo(() => {
    const nowD = new Date();
    return salesUsers
      .map((u: any) => {
        const userDeals = deals.filter((d: any) => d.assignedToId === u.id || d.assignedToName === u.name);
        const userQuotes = quotations.filter((q: any) => q.preparedById === u.id || q.preparedByName === u.name);
        const quoted = userQuotes.reduce((s: number, q: any) => s + Number(q.grandTotal ?? 0), 0);
        const wonDeals = userDeals.filter((d: any) => d.stage === "won");
        const won = wonDeals.reduce((s: number, d: any) => s + Number(d.value ?? 0), 0);
        const userTargets = targets.filter((t: any) => t.userId === u.id && t.year === year);
        const target = userTargets.reduce((s: number, t: any) => {
          if (t.period === "yearly")    return s + Number(t.targetAmount ?? 0);
          if (t.period === "quarterly") return s + Number(t.targetAmount ?? 0) * 4;
          if (t.period === "monthly")   return s + Number(t.targetAmount ?? 0) * 12;
          return s;
        }, 0);
        const sparkline: number[] = [];
        for (let i = 5; i >= 0; i--) {
          const ms = new Date(nowD.getFullYear(), nowD.getMonth() - i, 1);
          const me = new Date(nowD.getFullYear(), nowD.getMonth() - i + 1, 1);
          const v = userDeals.filter((d: any) => {
            if (d.stage !== "won") return false;
            const dt = d.closedAt ?? d.updatedAt ?? d.createdAt;
            if (!dt) return false;
            const t = new Date(dt).getTime();
            return t >= ms.getTime() && t < me.getTime();
          }).reduce((s: number, d: any) => s + Number(d.value ?? 0), 0);
          sparkline.push(v);
        }
        return {
          id: u.id, name: u.name, quoted, won, target, sparkline,
          quoteCount: userQuotes.length, wonCount: wonDeals.length,
          attainment: target > 0 ? Math.round((won / target) * 100) : null,
        };
      })
      .filter((r: any) => r.quoted > 0 || r.won > 0 || r.target > 0)
      .sort((a: any, b: any) => b.won - a.won);
  }, [salesUsers, quotations, deals, targets, year]);

  // Legacy compact leaderboard panel keeps its top-8 cap.
  const leaderboard = useMemo(() => salesPerformance.slice(0, 8), [salesPerformance]);

  // ---- Recent quotations ----
  const recentQuotations = useMemo(
    () => [...quotations].sort((a: any, b: any) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 6),
    [quotations],
  );

  // ---- Pending approvals / hot lists ----
  const draftQuotations    = quotations.filter((q: any) => (q.status ?? "").toLowerCase() === "draft").length;
  const pendingApprovalQ   = quotations.filter((q: any) => (q.status ?? "").toLowerCase() === "pending_approval").length;
  const sentQuotations     = quotations.filter((q: any) => (q.status ?? "").toLowerCase() === "sent").length;
  const pendingPIs         = proformas.filter((p: any) => ["draft", "pending_approval"].includes((p.status ?? "").toLowerCase())).length;
  const openLpos           = lpos.filter((l: any) => !["completed", "delivered", "closed"].includes((l.status ?? "").toLowerCase())).length;

  // ---- Quotes expiring within 7 days ----
  const expiringQuotes = useMemo(() => {
    const horizon = Date.now() + 7 * 86_400_000;
    return (quotations as any[]).filter(q => {
      const exp = q.expiryDate ?? q.validUntil;
      if (!exp) return false;
      const t = new Date(exp).getTime();
      const status = (q.status ?? "").toLowerCase();
      return t > Date.now() && t < horizon && !["accepted", "approved", "won", "rejected", "expired"].includes(status);
    }).sort((a, b) => (a.expiryDate ?? a.validUntil ?? "").localeCompare(b.expiryDate ?? b.validUntil ?? ""));
  }, [quotations]);

  // ---- Recent PIs / LPOs ----
  const recentPIs  = useMemo(() => [...proformas].sort((a: any, b: any) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 5), [proformas]);
  const recentLpos = useMemo(() => [...lpos].sort((a: any, b: any) => (b.createdAt ?? b.lpoDate ?? "").localeCompare(a.createdAt ?? a.lpoDate ?? "")).slice(0, 5), [lpos]);

  // ---- Sales insights banner ----
  const salesInsights = useMemo(() => {
    const out: { tone: "red" | "amber" | "blue"; text: string }[] = [];
    if (expiringQuotes.length > 0) out.push({ tone: "amber", text: `${expiringQuotes.length} quotation${expiringQuotes.length === 1 ? "" : "s"} expiring within 7 days — chase the client` });
    if (pendingApprovalQ > 0)   out.push({ tone: "amber", text: `${pendingApprovalQ} quotation${pendingApprovalQ === 1 ? "" : "s"} pending internal approval` });
    if (sentQuotations > 0)     out.push({ tone: "blue",  text: `${sentQuotations} quotation${sentQuotations === 1 ? "" : "s"} sent · awaiting client decision` });
    if (pendingPIs > 0)         out.push({ tone: "amber", text: `${pendingPIs} proforma invoice${pendingPIs === 1 ? "" : "s"} need approval` });
    if (out.length === 0 && quotations.length > 0) out.push({ tone: "blue", text: "Sales pipeline running smoothly — no urgent quotes." });
    return out.slice(0, 4);
  }, [expiringQuotes, pendingApprovalQ, sentQuotations, pendingPIs, quotations]);

  return (
    <div className="space-y-5">
      <ExecutiveHeader
        icon={ShoppingBag}
        title="Sales Command Center"
        subtitle="Quotations, Proforma Invoices, LPOs · Conversion · Targets"
      >
        <Button size="sm" variant="secondary" asChild className="bg-white/15 hover:bg-white/25 text-white border-0">
          <Link href="/sales/quotations"><FileText className="w-4 h-4 mr-1.5" />Quotations</Link>
        </Button>
        <Button size="sm" variant="secondary" asChild className="bg-white/15 hover:bg-white/25 text-white border-0">
          <Link href="/sales/proforma-invoices"><FileCheck className="w-4 h-4 mr-1.5" />PIs</Link>
        </Button>
        <Button size="sm" asChild className="bg-white text-[#0f2d5a] hover:bg-white/90">
          <Link href="/sales/quotations/new"><Sparkles className="w-4 h-4 mr-1.5" />New Quote</Link>
        </Button>
      </ExecutiveHeader>

      {/* Sales insights banner */}
      {salesInsights.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm" data-testid="banner-sales-insights">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#0f2d5a] to-[#1e6ab0]" />
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] flex items-center justify-center shadow">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-semibold">Sales Insights</h3>
            <Badge variant="secondary" className="text-[10px] bg-[#1e6ab0]/10 text-[#1e6ab0] border-0">live</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {salesInsights.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm rounded-lg p-2 bg-muted/40">
                <div className={`w-2 h-2 rounded-full shrink-0 ${r.tone === "red" ? "bg-red-500" : r.tone === "amber" ? "bg-orange-500" : "bg-emerald-500"}`} />
                <span className="text-foreground/85">{r.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(() => {
        const openQuotations = quotations.filter((q: any) => !["accepted", "approved", "won", "rejected", "expired", "lost"].includes((q.status ?? "").toLowerCase())).length;
        const lpoMtd = lpos.filter((l: any) => {
          const d = l.lpoDate ?? l.createdAt;
          return d && new Date(d) >= monthStart;
        });
        const lpoMtdVal = lpoMtd.reduce((s: number, l: any) => s + Number(l.lpoValue ?? 0), 0);
        const conversionRate = quotations.length > 0 ? Math.round((lpos.length / quotations.length) * 100) : 0;
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="primary-sales-kpi-strip">
            <KPIWidget icon={FileText}      tone="blue"   label="Open Quotations"  value={openQuotations}      sub={`${sentQuotations} sent · ${pendingApprovalQ} pending`}                              href="/sales/quotations"        testId="kpi-open-quotations" />
            <KPIWidget icon={FileText}      tone="indigo" label="Quotation Value"  value={fmtAED(quotationValue)} sub={`${quotations.length} total quotations`}                                          href="/sales/quotations"        testId="kpi-quotation-value" />
            <KPIWidget icon={FileCheck}     tone="amber"  label="Proforma Pending" value={pendingPIs}          sub={`${proformas.length} total proforma`}                                                href="/sales/proforma-invoices" testId="kpi-proforma-pending" />
            <KPIWidget icon={Target}        tone="teal"   label="Conversion Rate"  value={`${conversionRate}%`} sub={`${lpos.length} LPOs from ${quotations.length} quotes`}                              href="/sales/lpos"              testId="kpi-conversion-rate" />
            <KPIWidget icon={Trophy}        tone="green"  label="Win Rate"         value={`${winRate}%`}        sub={`${acceptedQuotes} of ${quotations.length} quotes won`}                              href="/sales/quotations"        testId="kpi-win-rate" />
            <KPIWidget icon={ClipboardList} tone="purple" label="LPOs This Month"  value={lpoMtd.length}        sub={lpoMtd.length > 0 ? `${fmtAED(lpoMtdVal)} value` : "No LPOs this month"}             href="/sales/lpos"              testId="kpi-lpos-mtd" />
          </div>
        );
      })()}

      {/* Secondary value KPIs — totals, trends, sparklines */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIWidget icon={FileText}   tone="blue"   label="Quotations · MTD"   value={fmtAED(quotationValueMtd)} sub={`${quotations.length} total quotations`} sparkline={quoteSpark} trend={trendPct(quoteSpark)} href="/sales/quotations" testId="kpi-quote-value" />
        <KPIWidget icon={FileCheck}  tone="amber"  label="Proforma Value"     value={fmtAED(piValue)}        sub={`${proformas.length} issued`}                                  sparkline={piSpark}    trend={trendPct(piSpark)}    href="/sales/proforma-invoices" testId="kpi-pi-value" />
        <KPIWidget icon={ClipboardList} tone="purple" label="LPOs Received"   value={fmtAED(lpoValue)}       sub={`${lpos.length} LPOs · ${openLpos} open`}                       sparkline={lpoSpark}   trend={trendPct(lpoSpark)}   href="/sales/lpos" testId="kpi-lpo-value" />
        <KPIWidget icon={Trophy}     tone="green"  label="Won Deals"          value={fmtAED(wonDealsValue)}  sub={`${deals.filter((d: any) => d.stage === "won").length} closed`} sparkline={wonSpark}   trend={trendPct(wonSpark)}   href="/crm/deals" testId="kpi-won-value" />
        <KPIWidget icon={FileText}   tone="slate"  label="Drafts"             value={draftQuotations}        sub={`${pendingApprovalQ} pending approval`}                          href="/sales/quotations" testId="kpi-drafts" />
        <KPIWidget icon={Receipt}    tone="indigo" label="Sent Quotations"    value={sentQuotations}         sub="Awaiting client response"                                        href="/sales/quotations" testId="kpi-sent" />
        <KPIWidget icon={Briefcase}  tone="navy"   label="Active Pipeline"    value={fmtAED(deals.filter((d: any) => !["won", "lost"].includes(d.stage)).reduce((s: number, d: any) => s + Number(d.value ?? 0), 0))} sub={`${deals.filter((d: any) => !["won", "lost"].includes(d.stage)).length} open deals`} href="/crm/pipeline" testId="kpi-pipeline" />
        <KPIWidget icon={Calendar}   tone="amber"  label="Quotes Expiring"    value={expiringQuotes.length}  sub="Within 7 days"                                                  href="/sales/quotations" testId="kpi-expiring" />
      </div>

      {/* Top Customers row */}
      <PanelCard
        title="Top Customers"
        subtitle="Ranked by total quotation value"
        icon={Users}
        data-testid="panel-top-customers"
      >
        {topClients.length === 0 ? (
          <Empty>No customer quotations yet.</Empty>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3" data-testid="grid-top-customers">
            {topClients.map((c: any, i: number) => {
              const href = c.leadId != null ? `/crm/leads/${c.leadId}` : "/crm/leads";
              const pct = topClients[0].value > 0 ? Math.min(100, (c.value / topClients[0].value) * 100) : 0;
              return (
                <Link key={c.name} href={href} className="block group" data-testid={`card-customer-${i}`}>
                  <div className="h-full rounded-2xl border border-border/60 bg-card p-3 shadow-sm group-hover:shadow-lg group-hover:-translate-y-0.5 group-hover:border-[#1e6ab0]/40 transition-all">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${i === 0 ? "bg-gradient-to-br from-orange-500 to-orange-700" : i === 1 ? "bg-gradient-to-br from-[#1e6ab0] to-[#0f2d5a]" : i === 2 ? "bg-gradient-to-br from-orange-300 to-orange-500" : "bg-[#1e6ab0]"}`}>
                        {i + 1}
                      </div>
                      <Avatar name={c.name} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate text-[#0f2d5a] dark:text-white">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground">Customer</div>
                      </div>
                    </div>
                    <div className="rounded-lg bg-gradient-to-br from-[#0f2d5a]/5 to-[#1e6ab0]/5 p-2.5 mb-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Quoted</div>
                      <div className="text-lg font-bold text-[#0f2d5a] dark:text-white truncate">{fmtAED(c.value)}</div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1.5">
                        <div className="h-full bg-gradient-to-r from-[#0f2d5a] to-[#1e6ab0]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {c.count} quote{c.count === 1 ? "" : "s"}
                      </span>
                      <span className="text-muted-foreground">
                        {c.lastDate ? new Date(c.lastDate).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-end text-[10px] text-[#1e6ab0] group-hover:underline">
                      View <ArrowRight className="w-3 h-3 ml-0.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </PanelCard>

      {/* Salesperson Performance row — all salespeople, sorted by won value */}
      <PanelCard
        title="Salesperson Performance"
        subtitle="All salespeople · ranked by won-deals value"
        icon={Crown}
        data-testid="panel-salesperson-performance"
      >
        {salesPerformance.length === 0 ? (
          <Empty>No salesperson activity yet.</Empty>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" data-testid="grid-salesperson-performance">
            {salesPerformance.map((row: any, i: number) => (
              <Link
                key={row.id}
                href={`/crm/leaderboard#sp-${row.id}`}
                className="block group"
                data-testid={`card-salesperson-${row.id}`}
              >
                <div className="h-full rounded-2xl border border-border/60 bg-card p-3 shadow-sm group-hover:shadow-lg group-hover:-translate-y-0.5 group-hover:border-[#1e6ab0]/40 transition-all">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${i === 0 ? "bg-gradient-to-br from-orange-500 to-orange-700" : i === 1 ? "bg-gradient-to-br from-[#1e6ab0] to-[#0f2d5a]" : i === 2 ? "bg-gradient-to-br from-orange-300 to-orange-500" : "bg-[#1e6ab0]"}`}>
                      {i + 1}
                    </div>
                    <Avatar name={row.name} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate text-[#0f2d5a] dark:text-white">{row.name}</div>
                      <div className="text-[10px] text-muted-foreground">Salesperson</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="rounded-lg bg-muted/40 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Won</div>
                      <div className="text-sm font-bold text-orange-600 truncate">{fmtAED(row.won)}</div>
                      <div className="text-[10px] text-muted-foreground">{row.wonCount} deal{row.wonCount === 1 ? "" : "s"}</div>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Quoted</div>
                      <div className="text-sm font-bold text-[#1e6ab0] truncate">{fmtAED(row.quoted)}</div>
                      <div className="text-[10px] text-muted-foreground">{row.quoteCount} quote{row.quoteCount === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                  {row.target > 0 ? (
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground">Target {fmtAED(row.target)}</span>
                        <span className={`font-bold ${row.attainment >= 100 ? "text-orange-600" : row.attainment >= 75 ? "text-[#1e6ab0]" : "text-[#0f2d5a] dark:text-white"}`}>
                          {row.attainment}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${row.attainment >= 100 ? "bg-gradient-to-r from-orange-500 to-orange-700" : row.attainment >= 75 ? "bg-gradient-to-r from-[#0f2d5a] to-[#1e6ab0]" : row.attainment >= 50 ? "bg-gradient-to-r from-[#1e6ab0] to-orange-400" : "bg-gradient-to-r from-orange-300 to-orange-500"}`}
                          style={{ width: `${Math.min(100, row.attainment)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mb-2 text-[10px] text-muted-foreground italic">No target set</div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Last 6 months</span>
                    <Sparkline data={row.sparkline} color="#1e6ab0" width={90} height={24} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </PanelCard>

      {/* Funnel + Status Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PanelCard title="Sales Funnel" subtitle="Lead → Won progression" icon={TrendingUp} className="lg:col-span-2">
          {funnelData.every(f => f.count === 0) ? (
            <Empty>No funnel activity yet.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={funnelData} layout="vertical" margin={{ left: 40, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} width={100} />
                <Tooltip formatter={(v: number, name: string) => name === "value" ? fmtAED(v) : v} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" fill="#1e6ab0" name="Count" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </PanelCard>

        <PanelCard title="Quotation Status" subtitle="Distribution across all quotations" icon={FileText}>
          {statusMix.length === 0 ? (
            <Empty>No quotations yet.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <RPieChart>
                <Pie data={statusMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                  {statusMix.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RPieChart>
            </ResponsiveContainer>
          )}
        </PanelCard>
      </div>

      {/* Monthly Trend */}
      <PanelCard title="Monthly Revenue Trend" subtitle="Quotations vs Proforma Invoices vs LPOs over the last 12 months" icon={Calendar}>
        {monthlyTrend.every(m => m.quotations === 0 && m.lpos === 0 && m.piValue === 0) ? (
          <Empty>No revenue data yet.</Empty>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyTrend}>
              <defs>
                <linearGradient id="grad-q" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e6ab0" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#1e6ab0" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-p" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-l" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtAED(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="quotations" stroke="#1e6ab0" strokeWidth={2} fill="url(#grad-q)" name="Quotations" />
              <Area type="monotone" dataKey="piValue"    stroke="#f97316" strokeWidth={2} fill="url(#grad-p)" name="Proforma" />
              <Area type="monotone" dataKey="lpos"       stroke="#10b981" strokeWidth={2} fill="url(#grad-l)" name="LPOs" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </PanelCard>

      {/* Sales leaderboard + Pending list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] flex items-center justify-center shadow">
                <Crown className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold">Sales Leaderboard · {year}</div>
                <div className="text-[11px] text-muted-foreground">Won deals, quotations & target attainment</div>
              </div>
            </div>
            <Link href="/projects/sales-performance" className="text-[11px] text-primary hover:underline flex items-center gap-1">
              Sales Performance <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {leaderboard.length === 0 ? (
            <Empty>No salesperson activity yet.</Empty>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((row: any, i: number) => (
                <div key={row.id} className="border rounded-xl p-2.5 hover:bg-muted/40 transition-all flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${i === 0 ? "bg-gradient-to-br from-orange-500 to-orange-700" : i === 1 ? "bg-gradient-to-br from-slate-400 to-slate-500" : i === 2 ? "bg-gradient-to-br from-orange-400 to-orange-800" : "bg-[#1e6ab0]"}`}>
                    {i + 1}
                  </div>
                  <Avatar name={row.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{row.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Won {fmtAED(row.won)} · Quoted {fmtAED(row.quoted)}
                      {row.target > 0 && ` · Target ${fmtAED(row.target)}`}
                    </div>
                  </div>
                  <div className="hidden md:block w-24 shrink-0">
                    <Sparkline data={row.sparkline} color="#1e6ab0" />
                  </div>
                  {row.attainment != null && (
                    <Badge className={`text-[10px] ${row.attainment >= 100 ? "bg-emerald-100 text-emerald-700" : row.attainment >= 75 ? "bg-blue-100 text-blue-700" : row.attainment >= 50 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>
                      {row.attainment}% target
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <PremiumCard tone="amber">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-semibold">Pending Approval</span>
              </div>
              <div className="text-2xl font-bold">{pendingApprovalQ + pendingPIs}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{pendingApprovalQ} quotations · {pendingPIs} PIs</div>
            </div>
          </PremiumCard>
          <PremiumCard tone="blue">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold">Sent Quotations</span>
              </div>
              <div className="text-2xl font-bold">{sentQuotations}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Awaiting client decision</div>
            </div>
          </PremiumCard>
          <PremiumCard tone="green">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold">Open LPOs</span>
              </div>
              <div className="text-2xl font-bold">{openLpos}</div>
              <div className="text-[11px] text-muted-foreground mt-1">In production / delivery</div>
            </div>
          </PremiumCard>
        </div>
      </div>

      {/* Top clients + recent quotations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PanelCard title="Top Clients by Quote Value" subtitle="Cumulative across all quotations" icon={Users}>
          {topClients.length === 0 ? (
            <Empty>No clients yet.</Empty>
          ) : (
            <div className="space-y-2">
              {topClients.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <Avatar name={c.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">{c.count} quotation{c.count === 1 ? "" : "s"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#0f2d5a] dark:text-white">{fmtAED(c.value)}</div>
                    <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-gradient-to-r from-[#0f2d5a] to-[#1e6ab0]" style={{ width: `${Math.min(100, (c.value / topClients[0].value) * 100)}%` }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">#{i + 1}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        <PanelCard title="Recent Quotations" subtitle="Latest 6 quotes created" icon={FileText} data-testid="panel-recent-quotes">
          {recentQuotations.length === 0 ? (
            <Empty>No quotations yet — <Link href="/sales/quotations/new" className="text-primary underline">create one</Link></Empty>
          ) : (
            <div className="space-y-2">
              {recentQuotations.map((q: any) => (
                <Link key={q.id} href={`/sales/quotations/${q.id}`} className="block">
                  <div className="border rounded-xl p-2.5 hover:bg-muted/40 hover:border-[#1e6ab0]/40 transition-all flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-mono text-primary">{q.quotationNumber}</span>
                        <StatusBadge status={q.status} />
                      </div>
                      <div className="text-sm font-medium truncate">{q.clientName}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{q.projectName ?? "—"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-[#0f2d5a] dark:text-white">{fmtAED(Number(q.grandTotal ?? 0))}</div>
                      <div className="text-[10px] text-muted-foreground">{q.createdAt ? new Date(q.createdAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short" }) : "—"}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </PanelCard>
      </div>

      {/* Recent PIs + LPOs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PanelCard title="Recent Proforma Invoices" subtitle="Latest 5 PIs issued" icon={FileCheck} data-testid="panel-recent-pis">
          {recentPIs.length === 0 ? (
            <Empty>No proforma invoices yet — <Link href="/sales/proforma-invoices" className="text-primary underline">create one</Link></Empty>
          ) : (
            <div className="space-y-2">
              {recentPIs.map((p: any) => (
                <Link key={p.id} href={`/sales/proforma-invoices/${p.id}`} className="block">
                  <div className="border rounded-xl p-2.5 hover:bg-muted/40 hover:border-[#1e6ab0]/40 transition-all flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-mono text-primary">{p.piNumber ?? p.proformaNumber ?? `PI-${p.id}`}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="text-sm font-medium truncate">{p.clientName ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{p.projectName ?? "—"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-[#0f2d5a] dark:text-white">{fmtAED(Number(p.total ?? p.grandTotal ?? 0))}</div>
                      <div className="text-[10px] text-muted-foreground">{p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short" }) : "—"}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </PanelCard>

        <PanelCard title="Recent LPOs" subtitle="Latest 5 client purchase orders" icon={ClipboardList} data-testid="panel-recent-lpos">
          {recentLpos.length === 0 ? (
            <Empty>No LPOs received yet.</Empty>
          ) : (
            <div className="space-y-2">
              {recentLpos.map((l: any) => (
                <Link key={l.id} href={`/sales/lpos`} className="block">
                  <div className="border rounded-xl p-2.5 hover:bg-muted/40 hover:border-[#1e6ab0]/40 transition-all flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-mono text-primary">{l.lpoNumber ?? `LPO-${l.id}`}</span>
                        <StatusBadge status={l.status} />
                      </div>
                      <div className="text-sm font-medium truncate">{l.clientName ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{l.projectName ?? "—"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-[#0f2d5a] dark:text-white">{fmtAED(Number(l.lpoValue ?? 0))}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {(l.lpoDate ?? l.createdAt) ? new Date(l.lpoDate ?? l.createdAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short" }) : "—"}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </PanelCard>
      </div>

      {/* Expiring quotes strip */}
      {expiringQuotes.length > 0 && (
        <PanelCard title="Quotes Expiring Soon" subtitle="Within the next 7 days · take action" icon={Calendar} data-testid="panel-expiring-quotes">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {expiringQuotes.slice(0, 8).map((q: any) => {
              const expDate = q.expiryDate ?? q.validUntil;
              const daysLeft = Math.max(0, Math.ceil((new Date(expDate).getTime() - Date.now()) / 86_400_000));
              return (
                <Link key={q.id} href={`/sales/quotations/${q.id}`} className="block">
                  <div className="border border-orange-300/60 rounded-xl p-3 hover:bg-muted/40 transition-all flex items-center gap-3">
                    <div className="w-1.5 h-9 rounded-full shrink-0 bg-orange-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-primary">{q.quotationNumber}</span>
                        <StatusBadge status={q.status} />
                      </div>
                      <div className="text-sm font-medium truncate">{q.clientName}</div>
                      <div className="text-[11px] text-muted-foreground truncate">Expires {new Date(expDate).toLocaleDateString("en-AE", { day: "2-digit", month: "short" })}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge className="bg-orange-100 text-orange-700">{daysLeft}d left</Badge>
                      <div className="text-sm font-bold text-[#0f2d5a] dark:text-white mt-0.5">{fmtAED(Number(q.grandTotal ?? 0))}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </PanelCard>
      )}
    </div>
  );
}

function PanelCard({ title, subtitle, icon: Icon, children, className = "", "data-testid": testId }: {
  title: string; subtitle?: string; icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode; className?: string; "data-testid"?: string;
}) {
  return (
    <div className={`bg-card border rounded-2xl p-4 space-y-3 shadow-sm ${className}`} data-testid={testId}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground italic py-6 text-center">{children}</div>;
}
