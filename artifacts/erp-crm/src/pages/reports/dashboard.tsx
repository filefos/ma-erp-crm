import { Link } from "wouter";
import { useMemo } from "react";
import {
  useGetDashboardSummary, useListQuotations, useListTaxInvoices, useListProjects,
  useListExpenses, useListPurchaseOrders, useListAttendance, useListInventoryItems,
  useListEmployees,
} from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { useListLeads, useListDeals } from "@workspace/api-client-react";
import {
  BarChart3, FileText, Receipt, Folders, Banknote, ShoppingCart, Clock, Package,
  TrendingUp, ArrowRight, Sparkles, PieChart as PieIcon, Target,
} from "lucide-react";
import { ExecutiveHeader, KPIWidget, weeklyValues, trendPct } from "@/components/crm/premium";

function fmtAED(v: number): string {
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `AED ${(v / 1_000).toFixed(0)}k`;
  return `AED ${Math.round(v).toLocaleString()}`;
}

const REPORTS = [
  { href: "/reports/sales-pipeline", label: "Sales Pipeline",  desc: "Deal flow, conversion, stage analytics", icon: TrendingUp, color: "from-blue-500 to-blue-700" },
  { href: "/reports/quotations",     label: "Quotations",      desc: "Drafts, sent, accepted by salesperson",  icon: FileText,   color: "from-[#0f2d5a] to-[#1e6ab0]" },
  { href: "/reports/revenue",        label: "Revenue",         desc: "Invoiced revenue, collections, AR",      icon: Receipt,    color: "from-emerald-500 to-emerald-700" },
  { href: "/reports/expenses",       label: "Expenses",        desc: "Cost analysis by category & department", icon: Banknote,   color: "from-orange-500 to-orange-700" },
  { href: "/reports/inventory",      label: "Inventory",       desc: "Stock movement, low stock, valuation",   icon: Package,    color: "from-purple-500 to-purple-700" },
  { href: "/reports/projects",       label: "Projects",        desc: "Stage breakdown, PM performance",        icon: Folders,    color: "from-teal-500 to-teal-700" },
  { href: "/reports/procurement",    label: "Procurement",     desc: "PR/PO/RFQ funnel, supplier spend",       icon: ShoppingCart, color: "from-indigo-500 to-indigo-700" },
  { href: "/reports/attendance",     label: "Attendance",      desc: "Workforce attendance & overtime",        icon: Clock,      color: "from-pink-500 to-pink-700" },
];

export function ReportsDashboard() {
  const { filterByCompany } = useActiveCompany();
  const { data: summary } = useGetDashboardSummary();
  const { data: quotationsRaw } = useListQuotations();
  const { data: invoicesRaw }   = useListTaxInvoices();
  const { data: projectsRaw }   = useListProjects({});
  const { data: expensesRaw }   = useListExpenses();
  const { data: posRaw }        = useListPurchaseOrders();
  const { data: attendanceRaw } = useListAttendance({});
  const { data: itemsRaw }      = useListInventoryItems({});
  const { data: leadsRaw }      = useListLeads({});
  const { data: dealsRaw }      = useListDeals();
  const { data: employeesRaw }  = useListEmployees({});

  const quotations = useMemo(() => filterByCompany(quotationsRaw ?? []), [quotationsRaw, filterByCompany]);
  const invoices   = useMemo(() => filterByCompany(invoicesRaw   ?? []), [invoicesRaw,   filterByCompany]);
  const projects   = useMemo(() => filterByCompany(projectsRaw   ?? []), [projectsRaw,   filterByCompany]);
  const expenses   = useMemo(() => filterByCompany(expensesRaw   ?? []), [expensesRaw,   filterByCompany]);
  const pos        = useMemo(() => filterByCompany(posRaw        ?? []), [posRaw,        filterByCompany]);
  const items      = useMemo(() => filterByCompany(itemsRaw      ?? []), [itemsRaw,      filterByCompany]);
  const leads      = useMemo(() => filterByCompany(leadsRaw      ?? []), [leadsRaw,      filterByCompany]);
  const deals      = useMemo(() => filterByCompany(dealsRaw      ?? []), [dealsRaw,      filterByCompany]);
  // Employees are company-scoped; attendance rows do not carry a companyId
  // of their own, so we must restrict attendance to the in-company employee
  // ids to avoid showing another company's attendance counts/rates — same
  // pattern used by `hr/dashboard.tsx` and `main-dashboard.tsx`.
  const employees  = useMemo(() => filterByCompany(employeesRaw ?? []), [employeesRaw, filterByCompany]);
  const employeeIdsInCompany = useMemo(
    () => new Set((employees as any[]).map(e => e.id)),
    [employees],
  );
  const attendance = useMemo(
    () => (attendanceRaw ?? []).filter((a: any) => employeeIdsInCompany.has(a.employeeId)),
    [attendanceRaw, employeeIdsInCompany],
  );

  // ---- KPIs ----
  const totalRevenue   = invoices.reduce((s: number, i: any) => s + Number(i.grandTotal ?? 0), 0);
  const totalQuoted    = quotations.reduce((s: number, q: any) => s + Number(q.grandTotal ?? 0), 0);
  const totalExpenses  = expenses.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
  const totalPoSpend   = pos.reduce((s: number, p: any) => s + Number(p.grandTotal ?? p.totalAmount ?? 0), 0);
  const inventoryValue = items.reduce((s: number, i: any) => s + Number(i.unitPrice ?? 0) * Number(i.currentStock ?? 0), 0);
  const grossMargin    = totalRevenue > 0 ? Math.round(((totalRevenue - totalExpenses - totalPoSpend) / totalRevenue) * 100) : 0;

  // ---- Sparklines ----
  const revenueSpark  = useMemo(() => weeklyValues(invoices,   "createdAt", (i: any) => Number(i.grandTotal ?? 0), 8), [invoices]);
  const expenseSpark  = useMemo(() => weeklyValues(expenses,   "createdAt", (e: any) => Number(e.amount ?? 0), 8), [expenses]);
  const quotedSpark   = useMemo(() => weeklyValues(quotations, "createdAt", (q: any) => Number(q.grandTotal ?? 0), 8), [quotations]);
  const poSpark       = useMemo(() => weeklyValues(pos,        "createdAt", (p: any) => Number(p.grandTotal ?? p.totalAmount ?? 0), 8), [pos]);

  // ---- Monthly profit & loss view (12 months) ----
  const now = new Date();
  const monthlyPnL = useMemo(() => {
    const arr: { month: string; revenue: number; expenses: number; profit: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const inRange = (raw?: string) => {
        if (!raw) return false;
        const t = new Date(raw).getTime();
        return t >= start.getTime() && t < end.getTime();
      };
      const rev = invoices.filter((iv: any) => inRange(iv.createdAt)).reduce((s: number, iv: any) => s + Number(iv.grandTotal ?? 0), 0);
      const exp = expenses.filter((e: any)  => inRange(e.createdAt)).reduce((s: number, e: any)  => s + Number(e.amount ?? 0), 0);
      const po  = pos.filter((p: any)       => inRange(p.createdAt)).reduce((s: number, p: any)  => s + Number(p.grandTotal ?? p.totalAmount ?? 0), 0);
      arr.push({
        month: start.toLocaleDateString("en-AE", { month: "short" }),
        revenue: rev,
        expenses: exp + po,
        profit:   rev - exp - po,
      });
    }
    return arr;
  }, [invoices, expenses, pos, now]);

  // ---- Mini sales pipeline funnel ----
  const miniFunnel = useMemo(() => ([
    { stage: "Leads",      count: leads.length },
    { stage: "Deals",      count: deals.filter((d: any) => !["won", "lost"].includes(d.stage)).length },
    { stage: "Quotations", count: quotations.length },
    { stage: "Invoices",   count: invoices.length },
    { stage: "Won",        count: deals.filter((d: any) => d.stage === "won").length },
  ]), [leads, deals, quotations, invoices]);

  // ---- Profit margin gauge ----
  const marginGauge = useMemo(() => ([
    { name: "Margin", value: Math.max(-100, Math.min(100, grossMargin)), fill: grossMargin >= 30 ? "#10b981" : grossMargin >= 10 ? "#1e6ab0" : grossMargin >= 0 ? "#f97316" : "#ef4444" },
  ]), [grossMargin]);

  // ---- Project / Attendance tile data ----
  const projectStageTiles = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of projects as any[]) {
      const k = (p.stage ?? "—").replace(/_/g, " ");
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([stage, count]) => ({ stage, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [projects]);

  const attendance30d = useMemo(() => {
    const cutoff = Date.now() - 30 * 86_400_000;
    const recent = (attendance as any[]).filter(a => a.date && new Date(a.date).getTime() >= cutoff);
    const present = recent.filter(a => ["present", "checked_in", "in"].includes((a.status ?? "").toLowerCase())).length;
    const absent  = recent.filter(a => (a.status ?? "").toLowerCase() === "absent").length;
    const late    = recent.filter(a => (a.status ?? "").toLowerCase() === "late").length;
    const total   = present + absent + late;
    const rate    = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, late, rate, total };
  }, [attendance]);

  // ---- Module health snapshot ----
  const moduleHealth = useMemo(() => ([
    { module: "Sales",       value: quotations.length, sub: fmtAED(totalQuoted) },
    { module: "Revenue",     value: invoices.length,   sub: fmtAED(totalRevenue) },
    { module: "Procurement", value: pos.length,        sub: fmtAED(totalPoSpend) },
    { module: "Expenses",    value: expenses.length,   sub: fmtAED(totalExpenses) },
    { module: "Projects",    value: projects.length,   sub: `${projects.filter((p: any) => p.stage !== "completed").length} active` },
    { module: "Inventory",   value: items.length,      sub: fmtAED(inventoryValue) },
    { module: "Attendance",  value: attendance.length, sub: "records" },
  ]), [quotations, invoices, pos, expenses, projects, items, attendance, totalQuoted, totalRevenue, totalPoSpend, totalExpenses, inventoryValue]);

  return (
    <div className="space-y-5">
      <ExecutiveHeader
        icon={BarChart3}
        title="Reports Command Center"
        subtitle="Cross-module analytics · P&L · Module health · Drill-downs"
      >
        <Button size="sm" variant="secondary" asChild className="bg-white/15 hover:bg-white/25 text-white border-0">
          <Link href="/reports"><BarChart3 className="w-4 h-4 mr-1.5" />Reports Hub</Link>
        </Button>
      </ExecutiveHeader>

      {/* Executive insights */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#0f2d5a] to-[#1e6ab0]" />
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] flex items-center justify-center shadow">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-sm font-semibold">Reporting Highlights</h3>
          <Badge variant="secondary" className="text-[10px] bg-[#1e6ab0]/10 text-[#1e6ab0] border-0">live</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg p-3 bg-muted/40">
            <div className="text-[11px] text-muted-foreground">Deals value (open + won)</div>
            <div className="text-lg font-bold text-[#0f2d5a] dark:text-white">{fmtAED(Number(summary?.dealsValue ?? 0))}</div>
          </div>
          <div className="rounded-lg p-3 bg-muted/40">
            <div className="text-[11px] text-muted-foreground">Outstanding receivables</div>
            <div className="text-lg font-bold text-[#0f2d5a] dark:text-white">{fmtAED(Number(summary?.outstandingReceivables ?? 0))}</div>
          </div>
          <div className="rounded-lg p-3 bg-muted/40">
            <div className="text-[11px] text-muted-foreground">Won deals · this month</div>
            <div className="text-lg font-bold text-[#0f2d5a] dark:text-white">{fmtAED(Number(summary?.wonDealsValue ?? 0))}</div>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIWidget icon={Receipt}     tone="green"  label="Total Revenue"   value={fmtAED(totalRevenue)}   sub={`${invoices.length} invoices`}     sparkline={revenueSpark} trend={trendPct(revenueSpark)} href="/reports/revenue"        testId="kpi-revenue" />
        <KPIWidget icon={FileText}    tone="navy"   label="Total Quoted"    value={fmtAED(totalQuoted)}    sub={`${quotations.length} quotations`} sparkline={quotedSpark}  trend={trendPct(quotedSpark)}  href="/reports/quotations"     testId="kpi-quoted" />
        <KPIWidget icon={ShoppingCart} tone="purple" label="Procurement Spend" value={fmtAED(totalPoSpend)} sub={`${pos.length} POs`}              sparkline={poSpark}      trend={trendPct(poSpark)}      href="/reports/procurement"    testId="kpi-procurement" />
        <KPIWidget icon={Banknote}    tone="amber"  label="Expenses"        value={fmtAED(totalExpenses)}  sub={`${expenses.length} entries`}      sparkline={expenseSpark} trend={trendPct(expenseSpark)} href="/reports/expenses"       testId="kpi-expenses" />
        <KPIWidget icon={Target}      tone={grossMargin >= 0 ? "teal" : "red"} label="Gross Margin" value={`${grossMargin}%`} sub="(Revenue − OpEx)/Revenue" testId="kpi-margin" />
        <KPIWidget icon={Folders}     tone="indigo" label="Active Projects" value={projects.filter((p: any) => p.stage !== "completed").length} sub={`${projects.length} total`} href="/reports/projects" testId="kpi-projects" />
        <KPIWidget icon={Package}     tone="blue"   label="Inventory Value" value={fmtAED(inventoryValue)} sub={`${items.length} SKUs`}            href="/reports/inventory"      testId="kpi-inventory" />
        <KPIWidget icon={Clock}       tone="slate"  label="Attendance Rec." value={attendance.length}      sub="All time"                          href="/reports/attendance"     testId="kpi-attendance" />
      </div>

      {/* P&L trend */}
      <div className="bg-card border rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-semibold">12-Month P&L Trend</div>
            <div className="text-[11px] text-muted-foreground">Revenue (invoices) − Expenses (OpEx + POs)</div>
          </div>
        </div>
        {monthlyPnL.every(m => m.revenue === 0 && m.expenses === 0) ? (
          <div className="text-xs text-muted-foreground italic py-6 text-center">No financial data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyPnL}>
              <defs>
                <linearGradient id="grad-rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-exp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.5} /><stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-prof" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e6ab0" stopOpacity={0.5} /><stop offset="100%" stopColor="#1e6ab0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtAED(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="revenue"  stroke="#10b981" strokeWidth={2} fill="url(#grad-rev)"  name="Revenue" />
              <Area type="monotone" dataKey="expenses" stroke="#f97316" strokeWidth={2} fill="url(#grad-exp)"  name="Expenses" />
              <Area type="monotone" dataKey="profit"   stroke="#1e6ab0" strokeWidth={2} fill="url(#grad-prof)" name="Profit" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Profit margin gauge + Sales pipeline funnel + tiles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border rounded-2xl p-4 shadow-sm" data-testid="panel-margin-gauge">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Target className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-semibold">Profit Margin Gauge</div>
              <div className="text-[11px] text-muted-foreground">(Revenue − OpEx − POs) / Revenue</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <RadialBarChart innerRadius="60%" outerRadius="100%" data={marginGauge} startAngle={210} endAngle={-30}>
              <PolarAngleAxis type="number" domain={[-100, 100]} tick={false} />
              <RadialBar dataKey="value" background={{ fill: "rgb(0 0 0 / 0.05)" }} cornerRadius={10} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="text-center -mt-12 relative z-10 pointer-events-none">
            <div className={`text-3xl font-bold ${grossMargin >= 0 ? "text-[#0f2d5a] dark:text-white" : "text-red-700"}`}>{grossMargin}%</div>
            <div className="text-[11px] text-muted-foreground">{grossMargin >= 30 ? "Excellent" : grossMargin >= 10 ? "Healthy" : grossMargin >= 0 ? "Watch" : "Loss"}</div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="rounded-lg border bg-muted/40 p-2 text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Revenue</div>
              <div className="text-xs font-bold">{fmtAED(totalRevenue)}</div>
            </div>
            <div className="rounded-lg border bg-muted/40 p-2 text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">OpEx + POs</div>
              <div className="text-xs font-bold">{fmtAED(totalExpenses + totalPoSpend)}</div>
            </div>
            <div className="rounded-lg border bg-muted/40 p-2 text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Profit</div>
              <div className={`text-xs font-bold ${(totalRevenue - totalExpenses - totalPoSpend) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmtAED(totalRevenue - totalExpenses - totalPoSpend)}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-4 shadow-sm lg:col-span-2" data-testid="panel-mini-funnel">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-semibold">Sales Pipeline Funnel</div>
              <div className="text-[11px] text-muted-foreground">Leads → Deals → Quotes → Invoices → Won</div>
            </div>
          </div>
          {miniFunnel.every(s => s.count === 0) ? (
            <div className="text-xs text-muted-foreground italic py-6 text-center">No pipeline activity yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={miniFunnel} layout="vertical" margin={{ left: 30, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} width={90} />
                <Tooltip />
                <Bar dataKey="count" fill="#1e6ab0" name="Records" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Project & Attendance tiles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border rounded-2xl p-4 shadow-sm" data-testid="panel-project-tiles">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Folders className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-semibold">Projects by Stage</div>
              <div className="text-[11px] text-muted-foreground">Top stages by project count</div>
            </div>
          </div>
          {projectStageTiles.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-6 text-center">No projects yet.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {projectStageTiles.map(t => (
                <div key={t.stage} className="rounded-xl border bg-gradient-to-br from-[#0f2d5a]/5 to-[#1e6ab0]/5 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground capitalize">{t.stage}</div>
                  <div className="text-2xl font-bold text-[#0f2d5a] dark:text-white">{t.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border rounded-2xl p-4 shadow-sm" data-testid="panel-attendance-tiles">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-semibold">Attendance · Last 30 Days</div>
              <div className="text-[11px] text-muted-foreground">Workforce reliability snapshot</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border bg-emerald-50/60 dark:bg-emerald-900/10 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Present</div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{attendance30d.present}</div>
            </div>
            <div className="rounded-xl border bg-orange-50/60 dark:bg-orange-900/10 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Late</div>
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">{attendance30d.late}</div>
            </div>
            <div className="rounded-xl border bg-red-50/60 dark:bg-red-900/10 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Absent</div>
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">{attendance30d.absent}</div>
            </div>
            <div className="rounded-xl border bg-gradient-to-br from-[#0f2d5a]/5 to-[#1e6ab0]/5 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Reliability</div>
              <div className="text-2xl font-bold text-[#0f2d5a] dark:text-white">{attendance30d.rate}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Module activity bar chart */}
      <div className="bg-card border rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
            <PieIcon className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-semibold">Module Health Snapshot</div>
            <div className="text-[11px] text-muted-foreground">Record counts across modules</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={moduleHealth}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
            <XAxis dataKey="module" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#1e6ab0" radius={[6, 6, 0, 0]} name="Records" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* All reports grid */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] flex items-center justify-center shadow">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold">Detailed Reports</div>
              <div className="text-[11px] text-muted-foreground">Drill into specific modules</div>
            </div>
          </div>
          <Link href="/reports" className="text-[11px] text-primary hover:underline flex items-center gap-1">
            Reports Hub <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {REPORTS.map(r => (
            <Link key={r.href} href={r.href} className="block">
              <div className="border rounded-xl p-4 hover:shadow-md hover:border-[#1e6ab0]/40 transition-all h-full flex flex-col">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${r.color} flex items-center justify-center shadow mb-2`}>
                  <r.icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-sm font-semibold text-[#0f2d5a] dark:text-white">{r.label}</div>
                <div className="text-[11px] text-muted-foreground mt-1 flex-1">{r.desc}</div>
                <div className="text-[11px] text-primary mt-2 flex items-center gap-1">View report <ArrowRight className="w-3 h-3" /></div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
