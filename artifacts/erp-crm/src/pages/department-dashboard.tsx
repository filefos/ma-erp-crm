import { useAuth } from "@/hooks/useAuth";
import { useGetDashboardSummary, useGetPendingApprovals, useGetRecentActivity, getGetRecentActivityQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Briefcase, FileText, Receipt, Clock, Users, Activity, CheckCircle2, ArrowRight } from "lucide-react";

const ROLE_LINKS: Record<string, { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[]> = {
  sales: [
    { label: "My Leads", href: "/crm/leads", icon: Users },
    { label: "My Deals", href: "/crm/deals", icon: Briefcase },
    { label: "Quotations", href: "/sales/quotations", icon: FileText },
  ],
  accounts: [
    { label: "Tax Invoices", href: "/accounts/invoices", icon: Receipt },
    { label: "Expenses", href: "/accounts/expenses", icon: Receipt },
    { label: "Cheques", href: "/accounts/cheques", icon: Receipt },
  ],
  finance: [
    { label: "Bank Accounts", href: "/accounts/bank-accounts", icon: Receipt },
    { label: "Cheques", href: "/accounts/cheques", icon: Receipt },
    { label: "Expenses", href: "/accounts/expenses", icon: Receipt },
  ],
  procurement: [
    { label: "Purchase Requests", href: "/procurement/purchase-requests", icon: FileText },
    { label: "Purchase Orders", href: "/procurement/purchase-orders", icon: FileText },
    { label: "Suppliers", href: "/procurement/suppliers", icon: Users },
  ],
  store: [
    { label: "Inventory Items", href: "/inventory/items", icon: FileText },
    { label: "Stock Entries", href: "/inventory/stock-entries", icon: FileText },
  ],
  hr: [
    { label: "Employees", href: "/hr/employees", icon: Users },
    { label: "Attendance", href: "/hr/attendance", icon: Clock },
  ],
  production: [
    { label: "Projects", href: "/projects", icon: Briefcase },
    { label: "Asset Register", href: "/assets", icon: FileText },
  ],
  management: [
    { label: "Reports", href: "/reports", icon: Activity },
    { label: "Quotations", href: "/sales/quotations", icon: FileText },
  ],
};

export function DepartmentDashboard() {
  const { user } = useAuth();
  const u = user as { name?: string; role?: string; departmentName?: string; companyName?: string; permissionLevel?: string } | undefined;
  const isAdmin = u?.permissionLevel === "super_admin" || u?.permissionLevel === "company_admin";
  const { data: summary } = useGetDashboardSummary();
  const { data: pending } = useGetPendingApprovals();
  const { data: recent } = useGetRecentActivity(undefined, { query: { queryKey: getGetRecentActivityQueryKey(), enabled: isAdmin } });

  const role = (u?.role ?? "user").toLowerCase();
  const links = ROLE_LINKS[role] ?? [
    { label: "Quotations", href: "/sales/quotations", icon: FileText },
    { label: "Tax Invoices", href: "/accounts/invoices", icon: Receipt },
  ];

  const pendingItems = pending ? [
    { label: "Quotations", count: pending.quotations, href: "/sales/quotations" },
    { label: "Purchase Requests", count: pending.purchaseRequests, href: "/procurement/purchase-requests" },
    { label: "Expenses", count: pending.expenses, href: "/accounts/expenses" },
    { label: "Cheques", count: pending.cheques, href: "/accounts/cheques" },
  ].filter(i => i.count > 0) : [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-r from-[#0f2d5a] to-[#1e6ab0] text-white p-6">
        <p className="text-sm text-white/70 mb-1">Welcome back,</p>
        <h1 className="text-2xl font-bold tracking-tight">{u?.name ?? "User"}</h1>
        <div className="text-sm text-white/80 mt-1 flex items-center gap-2 flex-wrap">
          <span>{u?.departmentName ?? "Department"} · {u?.companyName ?? "Workspace"}</span>
          <Badge className="bg-white/15 hover:bg-white/15 text-white border-0 font-mono text-[10px]">
            {(u?.permissionLevel ?? "user").replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3 text-[#0f2d5a] dark:text-white">Quick Actions</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {links.map(link => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-[#1e6ab0]">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#1e6ab0]/10">
                      <Icon className="w-4 h-4 text-[#1e6ab0]" />
                    </div>
                    <span className="flex-1 font-medium text-sm">{link.label}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Active Quotations</div>
            <div className="text-2xl font-bold mt-1 text-[#1e6ab0]">{summary?.totalQuotations ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Active Deals</div>
            <div className="text-2xl font-bold mt-1 text-[#1e6ab0]">{summary?.totalDeals ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Pending Approvals</div>
            <div className="text-2xl font-bold mt-1 text-amber-600">{summary?.pendingApprovals ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Items Awaiting Action</CardTitle></CardHeader>
          <CardContent>
            {pendingItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                <p className="text-sm text-muted-foreground">All clear</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingItems.map(item => (
                  <Link key={item.href} href={item.href}>
                    <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <span className="text-sm">{item.label}</span>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-bold">{item.count}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
          <CardContent>
            {recent && recent.length > 0 ? (
              <div className="space-y-2">
                {recent.slice(0, 6).map(log => (
                  <div key={log.id} className="flex items-start gap-2 text-xs border-b border-border/40 last:border-0 pb-2 last:pb-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1e6ab0] mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{log.userName ?? "System"} · <span className="text-muted-foreground capitalize">{log.action.replace(/_/g, " ")}</span></div>
                      <div className="text-muted-foreground truncate">{log.details}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-muted-foreground text-center py-6">No recent activity</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
