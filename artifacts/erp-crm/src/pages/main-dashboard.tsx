import { useMemo } from "react";
import { Link } from "wouter";
import {
  useListLeads, useListDeals, useListQuotations, useListProformaInvoices,
  useListLpos, useListTaxInvoices, useListPaymentsReceived, useListExpenses,
  useListPurchaseOrders, useListPurchaseRequests, useListSuppliers,
  useListInventoryItems, useListEmployees, useListAttendance, useListProjects,
  useListAssets, useListCheques, useListNotifications,
  getListLeadsQueryKey, getListDealsQueryKey, getListQuotationsQueryKey,
  getListProformaInvoicesQueryKey, getListLposQueryKey, getListTaxInvoicesQueryKey,
  getListPaymentsReceivedQueryKey, getListExpensesQueryKey,
  getListPurchaseOrdersQueryKey, getListPurchaseRequestsQueryKey,
  getListSuppliersQueryKey, getListInventoryItemsQueryKey,
  getListEmployeesQueryKey, getListAttendanceQueryKey, getListProjectsQueryKey,
  getListAssetsQueryKey, getListChequesQueryKey,
} from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, BarChart, Bar, PieChart as RPieChart, Pie, Cell,
} from "recharts";
import {
  LayoutDashboard, Users, Briefcase, FileText, Receipt, ShoppingCart, Package,
  HardHat, Folders, Wrench, BarChart3, Mail, AlertTriangle, ArrowRight,
  TrendingUp, Crown, Bell, ShieldCheck, CalendarClock, Building2, Sparkles,
  ArrowDownCircle, ArrowUpCircle, Activity,
} from "lucide-react";
import {
  ExecutiveHeader, KPIWidget, PremiumCard, Avatar,
  weeklyValues, weeklyCounts, trendPct, localDayKey,
} from "@/components/crm/premium";

const PALETTE = ["#0f2d5a", "#1e6ab0", "#3b82f6", "#10b981", "#f97316", "#8b5cf6", "#14b8a6", "#ef4444"];

function fmtAED(v: number): string {
  if (!isFinite(v)) return "AED 0";
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `AED ${(v / 1_000).toFixed(0)}k`;
  return `AED ${Math.round(v).toLocaleString()}`;
}

function PanelCard({ title, subtitle, icon: Icon, children, className = "", action }: {
  title: string; subtitle?: string; icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode; className?: string; action?: React.ReactNode;
}) {
  return (
    <div className={`bg-card border rounded-2xl p-4 space-y-3 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{title}</div>
            {subtitle && <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground py-6 text-center">{children}</div>;
}

export function MainExecutiveDashboard() {
  const { user } = useAuth();
  const { filterByCompany, companyShort } = useActiveCompany();
  const { can, ready: permsReady } = usePermissions();
  const now = new Date();

  // Permission flags — drive both query enablement and conditional rendering
  // so we never fetch or expose data the current user cannot view.
  const canLeads      = can("leads");
  const canDeals      = can("deals");
  const canQuotes     = can("quotations");
  const canProforma   = can("proforma_invoices");
  const canLpos       = can("lpos");
  const canInvoices   = can("tax_invoices");
  // NOTE on module mapping: payments-received and payments-made routes are
  // both guarded by the `expenses` module in App.tsx, so the dashboard MUST
  // gate payments queries/aggregates by the same key — otherwise a user with
  // tax_invoices but not expenses could see payment totals here that they
  // cannot see anywhere else (broken access control).
  const canExpenses   = can("expenses");
  const canPayments   = canExpenses;
  const canPos        = can("purchase_orders");
  const canPrs        = can("purchase_requests");
  const canSuppliers  = can("suppliers");
  const canItems      = can("inventory_items");
  const canEmployees  = can("employees");
  const canAttendance = can("attendance");
  const canProjects   = can("projects");
  const canAssets     = can("assets");
  const canCheques    = can("cheques");
  const canCrm        = canLeads || canDeals;
  const canSales      = canQuotes || canProforma || canLpos;
  const canAccounts   = canInvoices || canPayments || canExpenses || canCheques;
  const canProcurement = canPos || canPrs || canSuppliers;

  const { data: leadsRaw }       = useListLeads({},              { query: { queryKey: getListLeadsQueryKey({}),                  enabled: canLeads      } });
  const { data: dealsRaw }       = useListDeals(undefined,       { query: { queryKey: getListDealsQueryKey(),                    enabled: canDeals      } });
  const { data: quotationsRaw }  = useListQuotations(undefined,  { query: { queryKey: getListQuotationsQueryKey(),               enabled: canQuotes     } });
  const { data: proformaRaw }    = useListProformaInvoices(undefined, { query: { queryKey: getListProformaInvoicesQueryKey(),    enabled: canProforma   } });
  const { data: lposRaw }        = useListLpos(undefined,        { query: { queryKey: getListLposQueryKey(),                     enabled: canLpos       } });
  const { data: invoicesRaw }    = useListTaxInvoices(undefined, { query: { queryKey: getListTaxInvoicesQueryKey(),              enabled: canInvoices   } });
  const { data: paymentsRaw }    = useListPaymentsReceived(undefined, { query: { queryKey: getListPaymentsReceivedQueryKey(),    enabled: canPayments   } });
  const { data: expensesRaw }    = useListExpenses(undefined,    { query: { queryKey: getListExpensesQueryKey(),                 enabled: canExpenses   } });
  const { data: posRaw }         = useListPurchaseOrders(undefined,    { query: { queryKey: getListPurchaseOrdersQueryKey(),     enabled: canPos        } });
  const { data: prsRaw }         = useListPurchaseRequests(undefined,  { query: { queryKey: getListPurchaseRequestsQueryKey(),   enabled: canPrs        } });
  const { data: suppliersRaw }   = useListSuppliers(undefined,   { query: { queryKey: getListSuppliersQueryKey(),                enabled: canSuppliers  } });
  const { data: itemsRaw }       = useListInventoryItems(undefined,    { query: { queryKey: getListInventoryItemsQueryKey(),     enabled: canItems      } });
  const { data: employeesRaw }   = useListEmployees(undefined,   { query: { queryKey: getListEmployeesQueryKey(),                enabled: canEmployees  } });
  const { data: attendanceRaw }  = useListAttendance(undefined,  { query: { queryKey: getListAttendanceQueryKey(),               enabled: canAttendance } });
  const { data: projectsRaw }    = useListProjects(undefined,    { query: { queryKey: getListProjectsQueryKey(),                 enabled: canProjects   } });
  const { data: assetsRaw }      = useListAssets(undefined,      { query: { queryKey: getListAssetsQueryKey(),                   enabled: canAssets     } });
  const { data: chequesRaw }     = useListCheques(undefined,     { query: { queryKey: getListChequesQueryKey(),                  enabled: canCheques    } });
  const { data: notifsRaw }      = useListNotifications();

  const leads      = useMemo(() => filterByCompany(leadsRaw      ?? []), [leadsRaw,      filterByCompany]);
  const deals      = useMemo(() => filterByCompany(dealsRaw      ?? []), [dealsRaw,      filterByCompany]);
  const quotations = useMemo(() => filterByCompany(quotationsRaw ?? []), [quotationsRaw, filterByCompany]);
  const proformas  = useMemo(() => filterByCompany(proformaRaw   ?? []), [proformaRaw,   filterByCompany]);
  const lpos       = useMemo(() => filterByCompany(lposRaw       ?? []), [lposRaw,       filterByCompany]);
  const invoices   = useMemo(() => filterByCompany(invoicesRaw   ?? []), [invoicesRaw,   filterByCompany]);
  const payments   = useMemo(() => filterByCompany(paymentsRaw   ?? []), [paymentsRaw,   filterByCompany]);
  const expenses   = useMemo(() => filterByCompany(expensesRaw   ?? []), [expensesRaw,   filterByCompany]);
  const pos        = useMemo(() => filterByCompany(posRaw        ?? []), [posRaw,        filterByCompany]);
  const prs        = useMemo(() => filterByCompany(prsRaw        ?? []), [prsRaw,        filterByCompany]);
  const suppliers  = useMemo(() => filterByCompany(suppliersRaw  ?? []), [suppliersRaw,  filterByCompany]);
  const items      = useMemo(() => filterByCompany(itemsRaw      ?? []), [itemsRaw,      filterByCompany]);
  const employees  = useMemo(() => filterByCompany(employeesRaw  ?? []), [employeesRaw,  filterByCompany]);
  // Attendance rows do not carry a companyId, so `filterByCompany` would
  // pass ALL of them through (it is permissive on missing companyId). We
  // must scope attendance via the in-company employee ids — same approach
  // as `hr/dashboard.tsx` — otherwise this dashboard could surface another
  // company's attendance counts.
  const employeeIdsInCompany = useMemo(
    () => new Set((employees as any[]).map(e => e.id)),
    [employees],
  );
  const attendance = useMemo(
    () => (attendanceRaw ?? []).filter((a: any) => employeeIdsInCompany.has(a.employeeId)),
    [attendanceRaw, employeeIdsInCompany],
  );
  const projects   = useMemo(() => filterByCompany(projectsRaw   ?? []), [projectsRaw,   filterByCompany]);
  const assets     = useMemo(() => filterByCompany(assetsRaw     ?? []), [assetsRaw,     filterByCompany]);
  const cheques    = useMemo(() => filterByCompany(chequesRaw    ?? []), [chequesRaw,    filterByCompany]);
  const notifs     = useMemo(() => filterByCompany(notifsRaw ?? []), [notifsRaw, filterByCompany]);

  // ---- KPI calculations ----
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const last30 = now.getTime() - 30 * 86_400_000;

  const newLeads30 = leads.filter((l: any) => l.createdAt && new Date(l.createdAt).getTime() >= last30).length;
  const openDealsValue = deals.filter((d: any) => !["won", "lost"].includes(d.stage))
    .reduce((s: number, d: any) => s + Number(d.value ?? 0), 0);
  const wonDealsMtd = deals.filter((d: any) => d.stage === "won" && d.updatedAt && new Date(d.updatedAt) >= monthStart)
    .reduce((s: number, d: any) => s + Number(d.value ?? 0), 0);

  const quotationValue = quotations.reduce((s: number, q: any) => s + Number(q.grandTotal ?? 0), 0);
  const openQuotations = quotations.filter((q: any) => !["accepted", "rejected", "expired", "won", "lost"].includes((q.status ?? "").toLowerCase())).length;

  const invoicedTotal = invoices.reduce((s: number, i: any) => s + Number(i.total ?? i.grandTotal ?? 0), 0);
  const paymentsReceivedMtd = payments
    .filter((p: any) => p.paymentDate && new Date(p.paymentDate) >= monthStart)
    .reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const paymentsReceivedAll = payments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const outstandingAR = Math.max(0, invoicedTotal - paymentsReceivedAll);

  const expensesMtd = expenses
    .filter((e: any) => e.expenseDate && new Date(e.expenseDate) >= monthStart)
    .reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);

  const openPos = pos.filter((p: any) => !["completed", "closed", "delivered", "cancelled"].includes((p.status ?? "").toLowerCase())).length;
  const pendingPRs = prs.filter((p: any) => ["pending", "pending_approval", "draft", "submitted"].includes((p.status ?? "").toLowerCase())).length;

  const lowStock = items.filter((i: any) => {
    const qty = Number(i.quantity ?? i.currentStock ?? 0);
    const min = Number(i.minStock ?? i.reorderLevel ?? 0);
    return min > 0 && qty <= min;
  }).length;

  const activeEmployees = employees.filter((e: any) => (e.status ?? "active").toLowerCase() === "active").length;
  const todayKey = localDayKey(now);
  const presentToday = attendance.filter((a: any) => {
    const d = (a.date ?? "").toString().slice(0, 10);
    return d === todayKey && (a.status ?? "").toLowerCase() === "present";
  }).length;

  const activeProjects = projects.filter((p: any) => !["completed", "cancelled", "on_hold"].includes((p.stage ?? p.status ?? "").toLowerCase())).length;
  const projectValue = projects.reduce((s: number, p: any) => s + Number(p.contractValue ?? p.projectValue ?? 0), 0);

  const totalAssets = assets.length;
  const totalAssetValue = assets.reduce((s: number, a: any) => s + Number(a.purchaseValue ?? a.currentValue ?? 0), 0);

  // ---- Sparklines ----
  const revenueSpark = useMemo(
    () => weeklyValues(payments, "paymentDate", (p: any) => Number(p.amount ?? 0), 8),
    [payments],
  );
  const quoteSpark = useMemo(
    () => weeklyValues(quotations, "createdAt", (q: any) => Number(q.grandTotal ?? 0), 8),
    [quotations],
  );
  const dealSpark = useMemo(
    () => weeklyValues(deals.filter((d: any) => d.stage === "won"), "updatedAt", (d: any) => Number(d.value ?? 0), 8),
    [deals],
  );
  const expenseSpark = useMemo(
    () => weeklyValues(expenses, "expenseDate", (e: any) => Number(e.amount ?? 0), 8),
    [expenses],
  );
  const leadSpark    = useMemo(() => weeklyCounts(leads, "createdAt", 8), [leads]);
  const poSpark      = useMemo(() => weeklyCounts(pos, "createdAt", 8), [pos]);
  const projectSpark = useMemo(
    () => weeklyValues(projects, "createdAt", (p: any) => Number(p.contractValue ?? p.projectValue ?? 0), 8),
    [projects],
  );

  // ---- 12 month revenue/expense/profit trend ----
  const monthlyTrend = useMemo(() => {
    const months: { month: string; revenue: number; expenses: number; profit: number; quotations: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const inRange = (raw?: string) => {
        if (!raw) return false;
        const t = new Date(raw).getTime();
        return t >= d.getTime() && t < next.getTime();
      };
      const rev = payments.filter((p: any) => inRange(p.paymentDate))
        .reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
      const exp = expenses.filter((e: any) => inRange(e.expenseDate))
        .reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
      const quoted = quotations.filter((q: any) => inRange(q.createdAt))
        .reduce((s: number, q: any) => s + Number(q.grandTotal ?? 0), 0);
      months.push({
        month: d.toLocaleDateString("en-AE", { month: "short" }),
        revenue: rev,
        expenses: exp,
        profit: rev - exp,
        quotations: quoted,
      });
    }
    return months;
  }, [payments, expenses, quotations, now]);

  // ---- Pipeline funnel across whole business ----
  const funnel = useMemo(() => ([
    { stage: "Leads",       count: leads.length },
    { stage: "Deals",       count: deals.filter((d: any) => !["won", "lost"].includes(d.stage)).length },
    { stage: "Quotations",  count: quotations.length },
    { stage: "Proforma",    count: proformas.length },
    { stage: "LPOs",        count: lpos.length },
    { stage: "Invoiced",    count: invoices.length },
  ]), [leads, deals, quotations, proformas, lpos, invoices]);

  // ---- Top payees (clients ranked by total payments received) ----
  const topClients = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of payments as any[]) {
      const key = p.clientName ?? p.payerName ?? "Unknown";
      m[key] = (m[key] ?? 0) + Number(p.amount ?? 0);
    }
    return Object.entries(m).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
  }, [payments]);

  // ---- 30-day daily cash flow strip ----
  const cash30d = useMemo(() => {
    const days: { day: string; inflow: number; outflow: number; net: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end   = new Date(d); end.setHours(23, 59, 59, 999);
      const inRange = (raw?: string) => {
        if (!raw) return false;
        const t = new Date(raw).getTime();
        return t >= start.getTime() && t <= end.getTime();
      };
      const inflow  = payments.filter((p: any) => inRange(p.paymentDate)).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
      const outflow = expenses.filter((e: any) => inRange(e.expenseDate)).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
      days.push({
        day: d.toLocaleDateString("en-AE", { day: "2-digit", month: "short" }),
        inflow,
        outflow,
        net: inflow - outflow,
      });
    }
    return days;
  }, [payments, expenses, now]);

  // ---- Cash flow split ----
  const cashSplit = useMemo(() => {
    const inflow = payments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
    const outflow = expenses.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
    return [
      { name: "Inflow",  value: inflow },
      { name: "Outflow", value: outflow },
    ];
  }, [payments, expenses]);

  // ---- Cross-module alerts ----
  const alerts = useMemo(() => {
    const list: { tone: "red" | "amber" | "blue"; icon: React.ComponentType<{ className?: string }>; label: string; href: string; count?: number }[] = [];
    const overdueCheques = cheques.filter((c: any) => {
      const due = c.dueDate ?? c.chequeDate;
      const status = (c.status ?? "").toLowerCase();
      return due && new Date(due) < now && !["cleared", "deposited", "paid"].includes(status);
    }).length;
    if (overdueCheques > 0) list.push({ tone: "red", icon: AlertTriangle, label: `${overdueCheques} overdue cheque${overdueCheques === 1 ? "" : "s"}`, href: "/accounts/cheques", count: overdueCheques });

    const stuckDeals = deals.filter((d: any) => {
      if (["won", "lost"].includes(d.stage)) return false;
      const upd = d.updatedAt ?? d.createdAt;
      return upd && (now.getTime() - new Date(upd).getTime()) > 30 * 86_400_000;
    }).length;
    if (stuckDeals > 0) list.push({ tone: "amber", icon: TrendingUp, label: `${stuckDeals} stuck deal${stuckDeals === 1 ? "" : "s"} (>30 days)`, href: "/crm/deals", count: stuckDeals });

    if (lowStock > 0) list.push({ tone: "amber", icon: Package, label: `${lowStock} item${lowStock === 1 ? "" : "s"} below reorder level`, href: "/inventory/items", count: lowStock });

    const expiringQuotes = quotations.filter((q: any) => {
      const exp = q.expiryDate ?? q.validUntil;
      if (!exp) return false;
      const t = new Date(exp).getTime();
      return t > now.getTime() && t < now.getTime() + 7 * 86_400_000;
    }).length;
    if (expiringQuotes > 0) list.push({ tone: "amber", icon: CalendarClock, label: `${expiringQuotes} quotation${expiringQuotes === 1 ? "" : "s"} expiring this week`, href: "/sales/quotations", count: expiringQuotes });

    if (pendingPRs > 0) list.push({ tone: "blue", icon: ShoppingCart, label: `${pendingPRs} purchase request${pendingPRs === 1 ? "" : "s"} awaiting approval`, href: "/procurement/purchase-requests", count: pendingPRs });

    const unreadNotifs = notifs.filter((n: any) => !n.isRead).length;
    if (unreadNotifs > 0) list.push({ tone: "blue", icon: Bell, label: `${unreadNotifs} unread notification${unreadNotifs === 1 ? "" : "s"}`, href: "/notifications", count: unreadNotifs });

    return list;
  }, [cheques, deals, lowStock, quotations, pendingPRs, notifs, now]);

  // ---- Segment shortcuts (permission-filtered) ----
  const segments: { label: string; href: string; icon: React.ComponentType<{ className?: string }>; tone: string; sub: string; allowed: boolean }[] = [
    { label: "CRM",         href: "/crm",                  icon: Users,         tone: "from-purple-500 to-purple-700",  sub: `${leads.length} leads · ${deals.length} deals`,        allowed: canCrm },
    { label: "Sales",       href: "/sales",                icon: FileText,      tone: "from-blue-500 to-blue-700",      sub: `${quotations.length} quotes · ${lpos.length} LPOs`,    allowed: canSales },
    { label: "Accounts",    href: "/accounts",             icon: Receipt,       tone: "from-emerald-500 to-emerald-700",sub: `${invoices.length} invoices`,                          allowed: canAccounts },
    { label: "Procurement", href: "/procurement/dashboard",icon: ShoppingCart,  tone: "from-orange-500 to-orange-700",  sub: `${pos.length} POs · ${suppliers.length} suppliers`,    allowed: canProcurement },
    { label: "Inventory",   href: "/inventory",            icon: Package,       tone: "from-teal-500 to-teal-700",      sub: `${items.length} items`,                                allowed: canItems },
    { label: "Projects",    href: "/projects/dashboard",   icon: Folders,       tone: "from-indigo-500 to-indigo-700",  sub: `${activeProjects} active`,                             allowed: canProjects },
    { label: "HR",          href: "/hr",                   icon: HardHat,       tone: "from-slate-600 to-slate-800",    sub: `${activeEmployees} active`,                            allowed: canEmployees || canAttendance },
    { label: "Assets",      href: "/assets/dashboard",     icon: Wrench,        tone: "from-cyan-500 to-cyan-700",      sub: `${totalAssets} assets`,                                allowed: canAssets },
    { label: "Email",       href: "/email/dashboard",      icon: Mail,          tone: "from-pink-500 to-pink-700",      sub: "Inbox & threads",                                      allowed: true },
    { label: "Reports",     href: "/reports/dashboard",    icon: BarChart3,     tone: "from-rose-500 to-rose-700",      sub: "Cross-module analytics",                               allowed: true },
  ].filter(s => s.allowed);

  const u = user as { name?: string; permissionLevel?: string } | undefined;
  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  // Wait for permissions to load before rendering anything that depends on
  // them — prevents a brief flash of empty/wrong content and avoids leaking
  // sections to users who shouldn't see them.
  if (!permsReady) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]" data-testid="dashboard-loading">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ExecutiveHeader
        icon={LayoutDashboard}
        title={`${greeting}, ${u?.name?.split(" ")[0] ?? "Team"}`}
        subtitle={`${companyShort} · Executive overview across every module · ${now.toLocaleDateString("en-AE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
      >
        <Badge className="bg-white/15 text-white border border-white/20 hover:bg-white/15 gap-1">
          <ShieldCheck className="w-3 h-3" />{u?.permissionLevel?.replace(/_/g, " ") ?? "User"}
        </Badge>
        <Button size="sm" asChild className="bg-white text-[#0f2d5a] hover:bg-white/90">
          <Link href="/sales/quotations/new"><Sparkles className="w-4 h-4 mr-1.5" />New Quote</Link>
        </Button>
      </ExecutiveHeader>

      {/* Cross-module alerts banner */}
      {alerts.length > 0 && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50/60 dark:bg-orange-950/20 dark:border-orange-900/40 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-semibold text-orange-900 dark:text-orange-200">Cross-module alerts ({alerts.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.map((a, i) => {
              const Icon = a.icon;
              const styles = a.tone === "red"   ? "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-200"
                           : a.tone === "amber" ? "bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-200"
                                                 : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-200";
              return (
                <Link key={i} href={a.href} className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-transparent transition-colors ${styles}`}>
                  <Icon className="w-3.5 h-3.5" />{a.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Top KPI strip — cross-module, permission-gated. Each widget renders
          only if the user can view its underlying module so we never expose
          aggregates the user is not allowed to see. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="executive-kpi-strip">
        {canPayments  && <KPIWidget icon={Receipt}        tone="green"  label="Revenue · MTD"    value={fmtAED(paymentsReceivedMtd)} sub={`${fmtAED(paymentsReceivedAll)} all-time`} sparkline={revenueSpark} trend={trendPct(revenueSpark)} href="/accounts/payments-received" testId="kpi-revenue" />}
        {canExpenses  && <KPIWidget icon={ArrowDownCircle} tone="red"   label="Expenses · MTD"   value={fmtAED(expensesMtd)}         sub={canPayments ? `${fmtAED(outstandingAR)} A/R outstanding` : `${expenses.length} expense entries`} sparkline={expenseSpark} trend={trendPct(expenseSpark)} href="/accounts/expenses" testId="kpi-expenses" />}
        {canQuotes    && <KPIWidget icon={FileText}       tone="blue"   label="Quotations Value" value={fmtAED(quotationValue)}      sub={`${quotations.length} quotes · ${openQuotations} open`} sparkline={quoteSpark} trend={trendPct(quoteSpark)} href="/sales" testId="kpi-quotes" />}
        {canDeals     && <KPIWidget icon={Briefcase}      tone="purple" label="Open Pipeline"    value={fmtAED(openDealsValue)}      sub={`${deals.filter((d: any) => !["won", "lost"].includes(d.stage)).length} open deals · MTD won ${fmtAED(wonDealsMtd)}`} sparkline={dealSpark} trend={trendPct(dealSpark)} href="/crm/pipeline" testId="kpi-pipeline" />}
        {canLeads     && <KPIWidget icon={Users}          tone="indigo" label="Leads · 30d"      value={newLeads30}                  sub={`${leads.length} total leads`}                            sparkline={leadSpark}    trend={trendPct(leadSpark)}    href="/crm/leads" testId="kpi-leads" />}
        {canPos       && <KPIWidget icon={ShoppingCart}   tone="amber"  label="Open POs"         value={openPos}                     sub={`${pos.length} total · ${canPrs ? `${pendingPRs} PRs pending` : "all approved"}`}        sparkline={poSpark}      trend={trendPct(poSpark)}      href="/procurement/dashboard" testId="kpi-pos" />}
        {canProjects  && <KPIWidget icon={Folders}        tone="teal"   label="Active Projects"  value={activeProjects}              sub={`${fmtAED(projectValue)} total project value`}            sparkline={projectSpark} trend={trendPct(projectSpark)} href="/projects/dashboard" testId="kpi-projects" />}
        {canEmployees && <KPIWidget icon={HardHat}        tone="navy"   label="Active Workforce" value={activeEmployees}             sub={`${canAttendance ? `${presentToday} present today` : `${employees.length} on roster`}${canAssets ? ` · ${totalAssets} assets · ${fmtAED(totalAssetValue)}` : ""}`} href="/hr" testId="kpi-workforce" />}
      </div>

      {/* If the user has zero module access, surface a clear empty state so
          the dashboard never appears blank-but-broken. */}
      {!canLeads && !canDeals && !canQuotes && !canProforma && !canLpos &&
        !canInvoices && !canPayments && !canExpenses && !canPos && !canPrs &&
        !canSuppliers && !canItems && !canEmployees && !canAttendance &&
        !canProjects && !canAssets && !canCheques && (
        <div className="rounded-2xl border bg-card p-8 text-center" data-testid="dashboard-empty-state">
          <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-base font-semibold mb-1">No modules assigned yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your account does not have access to any module yet. Please contact your administrator
            to request the permissions you need.
          </p>
        </div>
      )}

      {/* Segment shortcuts — quick jump to every module dashboard */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#1e6ab0]" />
            <h2 className="text-sm font-semibold text-[#0f2d5a] dark:text-white">Jump to a module dashboard</h2>
          </div>
          <span className="text-[11px] text-muted-foreground">{segments.length} workspaces</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {segments.map(s => {
            const Icon = s.icon;
            return (
              <Link key={s.label} href={s.href} className="block group">
                <PremiumCard tone="blue" className="h-full">
                  <div className="p-3 flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow shrink-0 bg-gradient-to-br ${s.tone}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-sm font-semibold text-[#0f2d5a] dark:text-white">
                        {s.label}
                        <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">{s.sub}</div>
                    </div>
                  </div>
                </PremiumCard>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Revenue trend + cash split — only when user can see accounts data */}
      {(canPayments || canExpenses || canQuotes) && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PanelCard title="Revenue · Expenses · Profit" subtitle="Last 12 months · all currencies in AED" icon={TrendingUp} className="lg:col-span-2">
          {monthlyTrend.every(m => m.revenue === 0 && m.expenses === 0) ? (
            <Empty>No revenue or expense data yet.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="md-rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="md-exp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="md-prf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e6ab0" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#1e6ab0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtAED(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue"  stroke="#10b981" strokeWidth={2} fill="url(#md-rev)" name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#md-exp)" name="Expenses" />
                <Area type="monotone" dataKey="profit"   stroke="#1e6ab0" strokeWidth={2} fill="url(#md-prf)" name="Profit" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </PanelCard>

        <PanelCard title="Cash Flow · All time" subtitle="Inflow vs Outflow" icon={ArrowUpCircle}>
          {cashSplit.every(c => c.value === 0) ? (
            <Empty>No cash movement yet.</Empty>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <RPieChart>
                  <Pie data={cashSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={42} paddingAngle={3}>
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtAED(v)} />
                </RPieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl border bg-emerald-50/50 dark:bg-emerald-900/10 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Inflow</div>
                  <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{fmtAED(cashSplit[0].value)}</div>
                </div>
                <div className="rounded-xl border bg-red-50/50 dark:bg-red-900/10 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Outflow</div>
                  <div className="text-sm font-bold text-red-700 dark:text-red-400">{fmtAED(cashSplit[1].value)}</div>
                </div>
              </div>
              <div className="rounded-xl border bg-gradient-to-br from-[#0f2d5a]/5 to-[#1e6ab0]/5 p-2 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Net</div>
                <div className={`text-lg font-bold ${cashSplit[0].value - cashSplit[1].value >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {fmtAED(cashSplit[0].value - cashSplit[1].value)}
                </div>
              </div>
            </>
          )}
        </PanelCard>
      </div>
      )}

      {/* 30-day cash flow strip + Top Payees mini cards — accounts only */}
      {(canPayments || canExpenses) && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PanelCard
          title="Cash Flow · Last 30 days"
          subtitle="Daily inflow vs outflow · running net"
          icon={ArrowUpCircle}
          className="lg:col-span-2"
          action={<Link href="/accounts" className="text-[11px] text-primary hover:underline flex items-center gap-1">Accounts <ArrowRight className="w-3 h-3" /></Link>}
        >
          {cash30d.every(d => d.inflow === 0 && d.outflow === 0) ? (
            <Empty>No cash movement in the last 30 days.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cash30d} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} data-testid="chart-cash-30d">
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
                <XAxis dataKey="day" tick={{ fontSize: 9 }} interval={3} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtAED(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="inflow"  stackId="a" fill="#10b981" name="Inflow"  radius={[3, 3, 0, 0]} />
                <Bar dataKey="outflow" stackId="b" fill="#ef4444" name="Outflow" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </PanelCard>

        <PanelCard title="Top Payees · 5 best customers" subtitle="Quick links to the highest-paying clients" icon={Crown} data-testid="panel-top-payees-cards">
          {topClients.length === 0 ? (
            <Empty>No payments received yet.</Empty>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {topClients.map((c, i) => (
                <Link key={c.name} href="/accounts/payments-received" className="block">
                  <div className="border rounded-xl p-2.5 hover:bg-muted/40 hover:border-[#1e6ab0]/40 transition-all flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate text-[#0f2d5a] dark:text-white">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground">Top payee</div>
                    </div>
                    <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400 shrink-0">{fmtAED(c.value)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </PanelCard>
      </div>
      )}

      {/* Low-stock strip — inventory only */}
      {canItems && (() => {
        const lowStockItems = (items as any[])
          .filter(i => {
            const qty = Number(i.quantity ?? i.currentStock ?? 0);
            const min = Number(i.minStock ?? i.reorderLevel ?? 0);
            return min > 0 && qty <= min;
          })
          .sort((a, b) => {
            const ra = Number(a.minStock ?? a.reorderLevel ?? 0) - Number(a.quantity ?? a.currentStock ?? 0);
            const rb = Number(b.minStock ?? b.reorderLevel ?? 0) - Number(b.quantity ?? b.currentStock ?? 0);
            return rb - ra;
          })
          .slice(0, 6);
        if (lowStockItems.length === 0) return null;
        return (
          <PanelCard
            title={`Low-Stock Items · ${lowStockItems.length}`}
            subtitle="Below reorder level — raise a purchase request"
            icon={Package}
            action={<Link href="/inventory/items" className="text-[11px] text-primary hover:underline flex items-center gap-1">View inventory <ArrowRight className="w-3 h-3" /></Link>}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2" data-testid="panel-low-stock">
              {lowStockItems.map((i: any) => {
                const qty = Number(i.quantity ?? i.currentStock ?? 0);
                const min = Number(i.minStock ?? i.reorderLevel ?? 0);
                const ratio = min > 0 ? Math.min(100, Math.max(0, (qty / min) * 100)) : 0;
                return (
                  <Link key={i.id} href="/inventory/items" className="block">
                    <div className="border border-orange-300/60 rounded-xl p-3 hover:bg-muted/40 transition-all">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-mono text-primary">{i.itemCode ?? i.sku ?? `#${i.id}`}</span>
                        <Badge className="bg-orange-100 text-orange-700 text-[10px] ml-auto">Low</Badge>
                      </div>
                      <div className="text-sm font-semibold truncate">{i.itemName ?? i.name ?? "—"}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-red-500 to-orange-500" style={{ width: `${ratio}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">{qty}/{min}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{i.category ?? "—"} · {i.location ?? i.warehouse ?? "—"}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </PanelCard>
        );
      })()}

      {/* Pipeline funnel + Top clients — sales/CRM/accounts data */}
      {(canCrm || canSales || canPayments) && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PanelCard title="Business Funnel" subtitle="Lead → Deal → Quote → PI → LPO → Invoice" icon={Activity} className="lg:col-span-2">
          {funnel.every(f => f.count === 0) ? (
            <Empty>No funnel activity yet.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={funnel} layout="vertical" margin={{ left: 30, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} width={90} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {funnel.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </PanelCard>

        <PanelCard title="Top Payees · Paid" subtitle="Cumulative payments received · ranked" icon={Crown}>
          {topClients.length === 0 ? (
            <Empty>No payments yet.</Empty>
          ) : (
            <div className="space-y-2">
              {topClients.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <Avatar name={c.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-gradient-to-r from-[#0f2d5a] to-[#1e6ab0]" style={{ width: `${Math.min(100, (c.value / topClients[0].value) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-[#0f2d5a] dark:text-white">{fmtAED(c.value)}</div>
                    <div className="text-[10px] text-muted-foreground">#{i + 1}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      </div>
      )}

    </div>
  );
}
