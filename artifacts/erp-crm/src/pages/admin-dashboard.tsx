import { useGetAdminSummary, useGetRecentActivity, getGetRecentActivityQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Building2, Users, Folders, ScrollText, ShieldCheck, ShieldAlert, Activity, ArrowRight } from "lucide-react";
import { FactoryResetCard } from "@/components/admin/factory-reset-card";

function StatCard({ icon: Icon, label, value, sub, tone = "primary" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; sub?: string; tone?: "primary" | "success" | "warning" | "neutral" }) {
  const tones: Record<string, string> = {
    primary: "bg-[#1e6ab0]",
    success: "bg-emerald-600",
    warning: "bg-orange-600",
    neutral: "bg-[#0f2d5a]",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${tones[tone]}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminDashboard() {
  const { user } = useAuth();
  const isSuperAdmin = user?.permissionLevel === "super_admin";
  const { data, isLoading } = useGetAdminSummary();
  const { data: recent } = useGetRecentActivity(undefined, {
    query: { queryKey: getGetRecentActivityQueryKey(), enabled: isSuperAdmin },
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><div className="h-16 bg-muted rounded animate-pulse" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Console</h1>
          <p className="text-muted-foreground text-sm">System-wide overview · companies, users, security & audit.</p>
        </div>
        <Badge className="bg-[#0f2d5a] text-white hover:bg-[#0f2d5a] gap-1">
          <ShieldCheck className="w-3 h-3" />Administrator
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Companies" value={data.totalCompanies} sub={`${data.activeCompanies} active`} tone="neutral" />
        <StatCard icon={Users} label="Users" value={data.totalUsers} sub={`${data.activeUsers} active`} tone="primary" />
        <StatCard icon={Folders} label="Departments" value={data.totalDepartments} tone="success" />
        <StatCard icon={ScrollText} label="Audit Events" value={data.totalAuditLogs} sub="all time" tone="neutral" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-600"><ShieldCheck className="w-4 h-4 text-white" /></div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Logins · 24h</div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{data.logins24h}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/40 dark:bg-orange-950/20 dark:border-orange-900">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-600"><ShieldAlert className="w-4 h-4 text-white" /></div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Failed Logins · 24h</div>
              <div className="text-xl font-bold text-orange-700 dark:text-orange-400">{data.failedLogins24h}</div>
            </div>
          </CardContent>
        </Card>
        <Link href="/admin/audit-logs">
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-[#1e6ab0]/20 bg-[#1e6ab0]/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#1e6ab0]"><Activity className="w-4 h-4 text-white" /></div>
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Audit Trail</div>
                <div className="text-sm font-semibold text-[#0f2d5a] dark:text-white">View all events</div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3 text-[#0f2d5a] dark:text-white">Companies</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {data.companyCards.map(c => (
            <Card key={c.id} className="overflow-hidden border-l-4 border-l-[#1e6ab0]">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#1e6ab0]" />
                      {c.shortName}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.name}</p>
                  </div>
                  <Badge variant="secondary" className="font-mono text-[10px] bg-[#0f2d5a] text-white hover:bg-[#0f2d5a]">{c.prefix}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div><div className="text-xl font-bold text-[#1e6ab0]">{c.userCount}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Users</div></div>
                  <div><div className="text-xl font-bold text-[#1e6ab0]">{c.leadCount}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Leads</div></div>
                  <div><div className="text-xl font-bold text-[#1e6ab0]">{c.dealCount}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Deals</div></div>
                  <div><div className="text-xl font-bold text-emerald-600">{(c.invoicesValue/1000).toFixed(0)}K</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Invoiced</div></div>
                </div>
                {c.trn && <div className="mt-3 text-[11px] text-muted-foreground">TRN: <span className="font-mono">{c.trn}</span></div>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {isSuperAdmin && <FactoryResetCard />}

      {recent && recent.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4" />Recent System Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recent.slice(0, 10).map(log => (
                <div key={log.id} className="flex items-center gap-3 text-sm border-b border-border/40 last:border-0 pb-2 last:pb-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1e6ab0] shrink-0" />
                  <span className="text-muted-foreground shrink-0 text-xs font-mono">{new Date(log.createdAt).toLocaleString()}</span>
                  <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{log.action.replace(/_/g, " ")}</Badge>
                  <span className="font-medium text-xs">{log.userName ?? `User #${log.userId ?? "?"}`}</span>
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
