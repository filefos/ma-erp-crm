import { useGetDashboardSummary, useGetSalesPipeline, useGetPendingApprovals, useGetInventoryAlerts, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Users, FileText, Briefcase, TrendingUp, Receipt, Package, Folders, AlertTriangle,
  Clock, CheckCircle2, DollarSign, ArrowUpRight
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from "recharts";

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#f97316", "#6366f1", "#ec4899"];

function KPICard({ title, value, sub, icon: Icon, color, href }: { title: string; value: string | number; sub?: string; icon: any; color: string; href?: string }) {
  const content = (
    <Card className="relative overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${color}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
        {href && <ArrowUpRight className="absolute bottom-3 right-3 w-3 h-3 text-muted-foreground/40" />}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: pipeline } = useGetSalesPipeline();
  const { data: pending } = useGetPendingApprovals();
  const { data: alerts } = useGetInventoryAlerts();
  const { data: recent } = useGetRecentActivity();

  const fmtAED = (v?: number) => v ? `AED ${(v / 1000).toFixed(0)}K` : "AED 0";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="h-16 bg-muted rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const kpis = [
    { title: "Total Leads", value: summary?.totalLeads ?? 0, sub: `${summary?.hotLeads ?? 0} hot leads`, icon: Users, color: "bg-blue-500", href: "/crm/leads" },
    { title: "Active Deals", value: summary?.totalDeals ?? 0, sub: fmtAED(summary?.dealsValue), icon: Briefcase, color: "bg-purple-500", href: "/crm/deals" },
    { title: "Quotations", value: summary?.totalQuotations ?? 0, sub: fmtAED(summary?.quotationsValue), icon: FileText, color: "bg-amber-500", href: "/sales/quotations" },
    { title: "Invoices", value: summary?.totalInvoices ?? 0, sub: fmtAED(summary?.invoicesValue), icon: Receipt, color: "bg-teal-500", href: "/accounts/invoices" },
    { title: "Outstanding", value: fmtAED(summary?.outstandingReceivables), sub: "Receivables", icon: DollarSign, color: "bg-red-500", href: "/accounts/invoices" },
    { title: "Active Projects", value: summary?.activeProjects ?? 0, sub: "In progress", icon: Folders, color: "bg-cyan-500", href: "/projects" },
    { title: "Low Stock Items", value: summary?.lowStockItems ?? 0, sub: "Need reorder", icon: Package, color: "bg-orange-500", href: "/inventory/items" },
    { title: "Pending Approvals", value: summary?.pendingApprovals ?? 0, sub: "Require action", icon: Clock, color: "bg-indigo-500", href: "/sales/quotations" },
  ];

  const pipelineStages = pipeline?.stages ?? [];
  const monthlyRevenue = pipeline?.monthlyRevenue ?? [];
  const leadSources = pipeline?.leadSources ?? [];

  const pendingItems = pending ? [
    { label: "Quotations", count: pending.quotations, href: "/sales/quotations" },
    { label: "Purchase Requests", count: pending.purchaseRequests, href: "/procurement/purchase-requests" },
    { label: "Purchase Orders", count: pending.purchaseOrders, href: "/procurement/purchase-orders" },
    { label: "Expenses", count: pending.expenses, href: "/accounts/expenses" },
    { label: "Cheques", count: pending.cheques, href: "/accounts/cheques" },
  ].filter(i => i.count > 0) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Prime Max & Elite Prefab — Business Overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => <KPICard key={i} {...kpi} />)}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales Pipeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sales Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {pipelineStages.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pipelineStages.filter(s => s.count > 0)} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="stage" tick={{ fontSize: 10 }} tickFormatter={s => s.replace("_"," ").slice(0,8)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any, n: string) => [v, n === "count" ? "Leads" : "Value"]} labelFormatter={l => l.replace("_"," ")} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No pipeline data</div>}
          </CardContent>
        </Card>

        {/* Monthly Revenue */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Monthly Revenue (AED)</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyRevenue} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={m => m.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: any) => [`AED ${v?.toLocaleString()}`, "Revenue"]} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No revenue data yet</div>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lead Sources */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lead Sources</CardTitle>
          </CardHeader>
          <CardContent>
            {leadSources.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={leadSources} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={70} label={({ source, count }) => `${source?.slice(0,8)}: ${count}`} labelLine={false} fontSize={10}>
                    {leadSources.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, n: string) => [v, "Leads"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No data</div>}
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                <p className="text-sm text-muted-foreground">All clear — nothing pending</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingItems.map(item => (
                  <Link key={item.href} href={item.href}>
                    <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <span className="text-sm">{item.label}</span>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 font-bold">{item.count}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!alerts || (alerts as any[]).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Package className="w-8 h-8 text-green-500 mb-2" />
                <p className="text-sm text-muted-foreground">All items stocked</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(alerts as any[]).slice(0, 5).map((item: any) => (
                  <Link href="/inventory/items" key={item.id}>
                    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.warehouseLocation}</p>
                      </div>
                      <div className="text-right ml-2 shrink-0">
                        <p className="text-sm font-bold text-red-600">{item.currentStock}</p>
                        <p className="text-xs text-muted-foreground">min: {item.minimumStock}</p>
                      </div>
                    </div>
                  </Link>
                ))}
                {(alerts as any[]).length > 5 && <Link href="/inventory/items" className="text-xs text-primary hover:underline block text-center pt-1">View all {(alerts as any[]).length} items</Link>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      {recent && (recent as any[]).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(recent as any[]).slice(0, 8).map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span className="text-muted-foreground shrink-0 text-xs">{new Date(log.createdAt).toLocaleDateString()}</span>
                  <span className="font-medium text-xs">{log.userName}</span>
                  <span className="text-muted-foreground text-xs truncate">{log.details}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
