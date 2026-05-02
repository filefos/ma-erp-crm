import { useAuth } from "@/hooks/useAuth";
import { useGetDashboardSummary, useGetPendingApprovals, useGetRecentActivity, useGetSalesPipeline, useGetInventoryAlerts, getGetRecentActivityQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Briefcase, FileText, Receipt, Clock, Users, Activity, CheckCircle2, ArrowRight,
  TrendingUp, Building2, Package, AlertTriangle, DollarSign, Flame, Target,
  ShoppingCart, BarChart2, CalendarCheck, MessageCircle
} from "lucide-react";

const ROLE_LINKS: Record<string, { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[]> = {
  sales: [
    { label: "My Leads", href: "/crm/leads", icon: Users },
    { label: "My Deals", href: "/crm/deals", icon: Briefcase },
    { label: "Quotations", href: "/sales/quotations", icon: FileText },
    { label: "Proforma Invoices", href: "/sales/proforma-invoices", icon: Receipt },
    { label: "LPOs", href: "/sales/lpos", icon: FileText },
    { label: "Activities", href: "/crm/activities", icon: Activity },
  ],
  accounts: [
    { label: "Tax Invoices", href: "/accounts/invoices", icon: Receipt },
    { label: "Expenses", href: "/accounts/expenses", icon: DollarSign },
    { label: "Cheques", href: "/accounts/cheques", icon: FileText },
    { label: "Delivery Notes", href: "/accounts/delivery-notes", icon: Package },
    { label: "Bank Accounts", href: "/accounts/bank-accounts", icon: Building2 },
  ],
  finance: [
    { label: "Bank Accounts", href: "/accounts/bank-accounts", icon: Building2 },
    { label: "Cheques", href: "/accounts/cheques", icon: FileText },
    { label: "Expenses", href: "/accounts/expenses", icon: DollarSign },
    { label: "Tax Invoices", href: "/accounts/invoices", icon: Receipt },
    { label: "Reports", href: "/reports/revenue", icon: BarChart2 },
  ],
  procurement: [
    { label: "Purchase Requests", href: "/procurement/purchase-requests", icon: FileText },
    { label: "Purchase Orders", href: "/procurement/purchase-orders", icon: ShoppingCart },
    { label: "Suppliers", href: "/procurement/suppliers", icon: Building2 },
    { label: "Procurement Report", href: "/reports/procurement", icon: BarChart2 },
  ],
  store: [
    { label: "Inventory Items", href: "/inventory/items", icon: Package },
    { label: "Stock Entries", href: "/inventory/stock-entries", icon: FileText },
    { label: "Inventory Report", href: "/reports/inventory", icon: BarChart2 },
  ],
  hr: [
    { label: "Employees", href: "/hr/employees", icon: Users },
    { label: "Attendance", href: "/hr/attendance", icon: CalendarCheck },
    { label: "Attendance Report", href: "/reports/attendance", icon: BarChart2 },
  ],
  production: [
    { label: "Projects", href: "/projects", icon: Briefcase },
    { label: "Asset Register", href: "/assets", icon: FileText },
    { label: "Project Report", href: "/reports/projects", icon: BarChart2 },
  ],
  management: [
    { label: "Reports Hub", href: "/reports", icon: BarChart2 },
    { label: "Sales Pipeline", href: "/reports/sales-pipeline", icon: TrendingUp },
    { label: "Revenue Report", href: "/reports/revenue", icon: DollarSign },
    { label: "Quotations", href: "/sales/quotations", icon: FileText },
    { label: "Projects", href: "/projects", icon: Briefcase },
    { label: "Leads", href: "/crm/leads", icon: Users },
  ],
};

const PIPELINE_STAGES = [
  { key: "new", label: "New", color: "bg-blue-500" },
  { key: "contacted", label: "Contacted", color: "bg-indigo-500" },
  { key: "qualified", label: "Qualified", color: "bg-purple-500" },
  { key: "site_visit", label: "Site Visit", color: "bg-teal-500" },
  { key: "quotation_required", label: "Quot. Req.", color: "bg-amber-500" },
  { key: "quotation_sent", label: "Quot. Sent", color: "bg-orange-500" },
  { key: "negotiation", label: "Negotiation", color: "bg-pink-500" },
  { key: "won", label: "Won ✅", color: "bg-green-500" },
  { key: "lost", label: "Lost", color: "bg-red-500" },
];

function KPICard({
  icon: Icon, label, value, sub, trend, tone = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub?: string;
  trend?: string;
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
}) {
  const tones: Record<string, { bg: string; icon: string }> = {
    primary: { bg: "bg-[#1e6ab0]", icon: "text-white" },
    success: { bg: "bg-emerald-500", icon: "text-white" },
    warning: { bg: "bg-amber-500", icon: "text-white" },
    danger: { bg: "bg-red-500", icon: "text-white" },
    neutral: { bg: "bg-[#0f2d5a]", icon: "text-white" },
  };
  const t = tones[tone];
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-16 h-16 bg-muted/20 rounded-full -translate-y-4 translate-x-4" />
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">{label}</p>
            <p className="text-2xl font-bold mt-0.5 tabular-nums">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
            {trend && <p className="text-[11px] text-emerald-600 font-medium mt-0.5">{trend}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${t.bg} shrink-0`}>
            <Icon className={`w-4 h-4 ${t.icon}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PendingBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 font-bold ml-auto">
      {count}
    </Badge>
  );
}

export function DepartmentDashboard() {
  const { user } = useAuth();
  const u = user as { name?: string; role?: string; departmentName?: string; companyName?: string; permissionLevel?: string } | undefined;
  const isAdmin = u?.permissionLevel === "super_admin" || u?.permissionLevel === "company_admin";
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: pending } = useGetPendingApprovals();
  const { data: pipeline } = useGetSalesPipeline();
  const { data: lowStockItems } = useGetInventoryAlerts();
  const { data: recent } = useGetRecentActivity(undefined, {
    query: { queryKey: getGetRecentActivityQueryKey(), enabled: isAdmin },
  });

  const role = (u?.role ?? "user").toLowerCase();
  const links = ROLE_LINKS[role] ?? [
    { label: "Quotations", href: "/sales/quotations", icon: FileText },
    { label: "Tax Invoices", href: "/accounts/invoices", icon: Receipt },
    { label: "Reports", href: "/reports", icon: BarChart2 },
  ];

  const allPendingItems = pending ? [
    { label: "Quotations to Approve", count: pending.quotations, href: "/sales/quotations", icon: FileText },
    { label: "Purchase Requests", count: pending.purchaseRequests, href: "/procurement/purchase-requests", icon: ShoppingCart },
    { label: "Purchase Orders (Draft)", count: pending.purchaseOrders, href: "/procurement/purchase-orders", icon: ShoppingCart },
    { label: "Expenses", count: pending.expenses, href: "/accounts/expenses", icon: Receipt },
    { label: "Proforma Invoices", count: pending.proformaInvoices, href: "/sales/proforma-invoices", icon: FileText },
    { label: "Unpaid Invoices", count: pending.taxInvoices, href: "/accounts/invoices", icon: DollarSign },
    { label: "Cheques (Draft)", count: pending.cheques, href: "/accounts/cheques", icon: FileText },
  ].filter(i => i.count > 0) : [];

  const todayGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const maxPipelineCount = Math.max(...(pipeline?.stages?.map(s => s.count) ?? [1]), 1);
  const maxRevenue = Math.max(...(pipeline?.monthlyRevenue?.map(m => m.revenue) ?? [1]), 1);

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="rounded-xl bg-gradient-to-r from-[#0f2d5a] to-[#1e6ab0] text-white p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
        <div className="absolute right-10 bottom-0 w-24 h-24 bg-white/5 rounded-full translate-y-8" />
        <p className="text-sm text-white/70 mb-0.5">{todayGreeting()},</p>
        <h1 className="text-2xl font-bold tracking-tight relative">{u?.name ?? "User"}</h1>
        <div className="text-sm text-white/80 mt-1.5 flex items-center gap-2 flex-wrap">
          <span>{u?.departmentName ?? "Department"} · {u?.companyName ?? "Workspace"}</span>
          <Badge className="bg-white/15 hover:bg-white/15 text-white border-0 font-mono text-[10px]">
            {(u?.permissionLevel ?? "user").replace(/_/g, " ")}
          </Badge>
        </div>
        {allPendingItems.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm text-white/90">
              <span className="font-bold text-amber-300">{allPendingItems.length}</span> item{allPendingItems.length > 1 ? "s" : ""} awaiting your attention
            </span>
          </div>
        )}
      </div>

      {/* KPI grid */}
      {summaryLoading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="h-14 bg-muted rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      ) : summary && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <KPICard icon={Users} label="Total Leads" value={summary.totalLeads} sub={`${summary.hotLeads} hot · ${summary.newLeadsThisMonth} this month`} tone="primary" />
          <KPICard icon={Briefcase} label="Active Deals" value={summary.totalDeals} sub={`AED ${(summary.dealsValue / 1000).toFixed(0)}K pipeline`} tone="neutral" />
          <KPICard icon={FileText} label="Quotations" value={summary.totalQuotations} sub={`AED ${(summary.quotationsValue / 1000).toFixed(0)}K total value`} tone="primary" />
          <KPICard icon={DollarSign} label="Invoiced (AED)" value={`${(summary.invoicesValue / 1000).toFixed(0)}K`} sub={`${((summary.invoicesValue - summary.outstandingReceivables) / 1000).toFixed(0)}K collected`} tone="success" />
          <KPICard icon={AlertTriangle} label="Outstanding" value={`AED ${(summary.outstandingReceivables / 1000).toFixed(0)}K`} sub="Receivables unpaid" tone={summary.outstandingReceivables > 100000 ? "warning" : "neutral"} />
          <KPICard icon={Target} label="Won This Month" value={summary.wonDealsThisMonth} sub={`AED ${(summary.wonDealsValue / 1000).toFixed(0)}K value`} tone="success" />
          <KPICard icon={Package} label="Low Stock Items" value={summary.lowStockItems} sub="Need reorder" tone={summary.lowStockItems > 0 ? "danger" : "success"} />
          <KPICard icon={Building2} label="Active Projects" value={summary.activeProjects} sub={`${summary.todayAttendance} staff checked in today`} tone="neutral" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</h2>
          <div className="space-y-2">
            {links.slice(0, 6).map(link => {
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href}>
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:shadow-sm hover:border-[#1e6ab0]/30 transition-all cursor-pointer group">
                    <div className="p-1.5 rounded-md bg-[#1e6ab0]/10 group-hover:bg-[#1e6ab0]/20 transition-colors">
                      <Icon className="w-4 h-4 text-[#1e6ab0]" />
                    </div>
                    <span className="flex-1 text-sm font-medium">{link.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[#1e6ab0] transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Items Awaiting Action</h2>
          <Card className="h-full">
            <CardContent className="p-0">
              {allPendingItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mb-2 opacity-80" />
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">No items pending your action.</p>
                </div>
              ) : (
                <div>
                  {allPendingItems.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.href + i} href={item.href}>
                        <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer border-b last:border-0 first:rounded-t-lg last:rounded-b-lg">
                          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="flex-1 text-sm">{item.label}</span>
                          <PendingBadge count={item.count} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alerts */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Low Stock Alerts
            {(lowStockItems?.length ?? 0) > 0 && <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-red-500 text-white">{lowStockItems?.length}</span>}
          </h2>
          <Card>
            <CardContent className="p-0">
              {!lowStockItems || lowStockItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                  <Package className="w-10 h-10 text-green-500 mb-2 opacity-80" />
                  <p className="text-sm font-medium">Stock levels OK</p>
                  <p className="text-xs text-muted-foreground mt-0.5">All items above minimum stock.</p>
                </div>
              ) : (
                <div>
                  {lowStockItems.slice(0, 6).map((item: any, i: number) => (
                    <div key={item.id ?? i} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 hover:bg-muted/20">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{item.itemCode}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-red-600">{item.currentStock}</div>
                        <div className="text-[10px] text-muted-foreground">min {item.minimumStock}</div>
                      </div>
                    </div>
                  ))}
                  {lowStockItems.length > 6 && (
                    <Link href="/reports/inventory">
                      <div className="px-4 py-2.5 text-center text-xs text-primary hover:underline cursor-pointer">
                        View all {lowStockItems.length} low stock items →
                      </div>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sales Pipeline */}
      {pipeline && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#1e6ab0]" />Lead Pipeline
              </CardTitle>
              <Link href="/reports/sales-pipeline" className="text-xs text-primary hover:underline">Full report →</Link>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {PIPELINE_STAGES.map(stage => {
                const data = pipeline.stages?.find((s: any) => s.stage === stage.key);
                const count = data?.count ?? 0;
                const pct = maxPipelineCount > 0 ? Math.round((count / maxPipelineCount) * 100) : 0;
                return (
                  <div key={stage.key} className="flex items-center gap-2">
                    <div className="w-20 text-xs text-right text-muted-foreground shrink-0">{stage.label}</div>
                    <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                      <div className={`h-full ${stage.color} opacity-75 rounded transition-all`} style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }} />
                    </div>
                    <div className="text-xs font-semibold w-6 text-right shrink-0">{count}</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#1e6ab0]" />Monthly Revenue (AED)
              </CardTitle>
              <Link href="/reports/revenue" className="text-xs text-primary hover:underline">Full report →</Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {pipeline.monthlyRevenue?.slice().reverse().slice(0, 6).reverse().map((m: any) => (
                <div key={m.month} className="flex items-center gap-2">
                  <div className="w-14 text-xs text-muted-foreground shrink-0">{m.month?.substring(5)}/{m.month?.substring(2, 4)}</div>
                  <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-[#1e6ab0]/60 rounded transition-all" style={{ width: `${maxRevenue > 0 ? (m.revenue / maxRevenue) * 100 : 0}%` }} />
                  </div>
                  <div className="text-xs font-medium w-16 text-right text-muted-foreground shrink-0">
                    AED {m.revenue >= 1000 ? `${(m.revenue / 1000).toFixed(0)}K` : m.revenue.toFixed(0)}
                  </div>
                </div>
              ))}
              {(!pipeline.monthlyRevenue || pipeline.monthlyRevenue.every((m: any) => m.revenue === 0)) && (
                <div className="text-sm text-muted-foreground text-center py-4">No revenue data yet.</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lead Sources + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {pipeline?.leadSources && pipeline.leadSources.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#1e6ab0]" />Lead Sources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(() => {
                const total = pipeline.leadSources.reduce((s: number, l: any) => s + l.count, 0);
                return pipeline.leadSources.map((src: any) => {
                  const pct = total > 0 ? Math.round((src.count / total) * 100) : 0;
                  return (
                    <div key={src.source} className="flex items-center gap-3">
                      <span className="capitalize text-xs w-24 shrink-0 text-muted-foreground">{src.source?.replace("_"," ") ?? "Unknown"}</span>
                      <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                        <div className="h-full bg-[#0f2d5a]/60 rounded" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium w-10 text-right">{src.count} <span className="text-muted-foreground">({pct}%)</span></span>
                    </div>
                  );
                });
              })()}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#1e6ab0]" />Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recent && recent.length > 0 ? (
              <div className="space-y-2">
                {recent.slice(0, 8).map(log => (
                  <div key={log.id} className="flex items-start gap-2.5 text-xs border-b border-border/40 last:border-0 pb-2 last:pb-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1e6ab0] mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">{log.userName ?? "System"}</span>
                        <Badge variant="secondary" className="text-[10px] capitalize py-0 h-4">{log.action.replace(/_/g, " ")}</Badge>
                      </div>
                      <div className="text-muted-foreground truncate mt-0.5">{log.details}</div>
                      <div className="text-muted-foreground/60 font-mono mt-0.5">{new Date(log.createdAt).toLocaleString("en-AE", { dateStyle: "short", timeStyle: "short" })}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <MessageCircle className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reports quick links */}
      <div className="bg-gradient-to-r from-[#0f2d5a]/5 to-[#1e6ab0]/5 border border-[#1e6ab0]/20 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2"><BarChart2 className="w-4 h-4 text-[#1e6ab0]" />Analytics & Reports</h2>
          <Link href="/reports" className="text-xs text-primary hover:underline">View all reports →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Sales Pipeline", href: "/reports/sales-pipeline", icon: TrendingUp, color: "text-blue-600" },
            { label: "Revenue", href: "/reports/revenue", icon: DollarSign, color: "text-green-600" },
            { label: "Expenses", href: "/reports/expenses", icon: Receipt, color: "text-amber-600" },
            { label: "Inventory", href: "/reports/inventory", icon: Package, color: "text-purple-600" },
            { label: "Projects", href: "/reports/projects", icon: Briefcase, color: "text-teal-600" },
            { label: "Attendance", href: "/reports/attendance", icon: CalendarCheck, color: "text-indigo-600" },
            { label: "Procurement", href: "/reports/procurement", icon: ShoppingCart, color: "text-orange-600" },
            { label: "Quotations", href: "/reports/quotations", icon: FileText, color: "text-rose-600" },
          ].map(r => {
            const Icon = r.icon;
            return (
              <Link key={r.href} href={r.href}>
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-card border hover:shadow-sm hover:border-[#1e6ab0]/40 transition-all cursor-pointer group">
                  <Icon className={`w-4 h-4 ${r.color}`} />
                  <span className="text-xs font-medium">{r.label}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto group-hover:text-[#1e6ab0]" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
