import { useMemo } from "react";
import { Link } from "wouter";
import {
  useListProjects, useListLpos, useListTaxInvoices, useListDeliveryNotes,
  useListUsers,
} from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart as RPieChart, Pie, Cell,
} from "recharts";
import {
  Folders, HardHat, Factory, Truck, Hammer, CheckCircle2, AlertTriangle,
  TrendingUp, Trophy, Crown, ArrowRight, Sparkles, Target, Calendar, MapPin, DollarSign,
} from "lucide-react";
import {
  ExecutiveHeader, KPIWidget, Avatar, weeklyValues, trendPct,
} from "@/components/crm/premium";

const STAGE_LABELS: Record<string, string> = {
  new_project:  "New",
  production:   "Production",
  procurement:  "Procurement",
  delivery:     "Delivery",
  installation: "Installation",
  testing:      "Testing",
  handover:     "Handover",
  completed:    "Completed",
};

const STAGE_COLORS: Record<string, string> = {
  new_project:  "#3b82f6",
  production:   "#8b5cf6",
  procurement:  "#f97316",
  delivery:     "#06b6d4",
  installation: "#f97316",
  testing:      "#a855f7",
  handover:     "#14b8a6",
  completed:    "#10b981",
};

function fmtAED(v: number): string {
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `AED ${(v / 1_000).toFixed(0)}k`;
  return `AED ${Math.round(v).toLocaleString()}`;
}

function projectProgress(p: any): number {
  // Map stage to a rough completion %
  const map: Record<string, number> = {
    new_project: 5, production: 25, procurement: 40,
    delivery: 60, installation: 75, testing: 85,
    handover: 95, completed: 100,
  };
  return map[p.stage] ?? 0;
}

export function ProjectsDashboard() {
  const { filterByCompany, activeCompanyId } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const eliteIconGrad = isElite ? "from-[#0D0D0D] to-[#8B0000]" : "from-[#0f2d5a] to-[#1e6ab0]";
  const chartBlue = isElite ? "#8B0000" : "#1e6ab0";
  const { data: projectsRaw }   = useListProjects({});
  const { data: lposRaw }       = useListLpos();
  const { data: invoicesRaw }   = useListTaxInvoices();
  const { data: dnRaw }         = useListDeliveryNotes();
  const { data: usersRaw }      = useListUsers();

  const projects  = useMemo(() => filterByCompany(projectsRaw ?? []), [projectsRaw, filterByCompany]);
  const lpos      = useMemo(() => filterByCompany(lposRaw     ?? []), [lposRaw,     filterByCompany]);
  const invoices  = useMemo(() => filterByCompany(invoicesRaw ?? []), [invoicesRaw, filterByCompany]);
  const dns       = useMemo(() => filterByCompany(dnRaw       ?? []), [dnRaw,       filterByCompany]);
  const users     = useMemo(() => filterByCompany(usersRaw ?? []), [usersRaw, filterByCompany]);

  // ---- KPIs ----
  const totalProjects     = projects.length;
  const activeProjects    = projects.filter((p: any) => p.stage !== "completed").length;
  const completedProjects = projects.filter((p: any) => p.stage === "completed").length;
  const totalValue        = projects.reduce((s: number, p: any) => s + Number(p.projectValue ?? 0), 0);
  const inProduction      = projects.filter((p: any) => p.stage === "production" || p.productionStatus === "in_progress").length;
  const inDelivery        = projects.filter((p: any) => p.stage === "delivery" || p.deliveryStatus === "in_progress").length;
  const inInstallation    = projects.filter((p: any) => p.stage === "installation" || p.installationStatus === "in_progress").length;
  const overdueProjects   = projects.filter((p: any) => {
    if (p.stage === "completed" || !p.endDate) return false;
    return new Date(p.endDate).getTime() < Date.now();
  }).length;

  const projectsSpark    = useMemo(() => weeklyValues(projects, "createdAt", () => 1, 8), [projects]);
  const valueSpark       = useMemo(() => weeklyValues(projects, "createdAt", (p: any) => Number(p.projectValue ?? 0), 8), [projects]);
  const completedSpark   = useMemo(
    () => weeklyValues(projects.filter((p: any) => p.stage === "completed"), "updatedAt", () => 1, 8),
    [projects],
  );

  // ---- Stage distribution ----
  const stageData = useMemo(() => {
    const counts: Record<string, { count: number; value: number }> = {};
    for (const stage of Object.keys(STAGE_LABELS)) counts[stage] = { count: 0, value: 0 };
    for (const p of projects as any[]) {
      const s = p.stage ?? "new_project";
      if (!counts[s]) counts[s] = { count: 0, value: 0 };
      counts[s].count++;
      counts[s].value += Number(p.projectValue ?? 0);
    }
    return Object.entries(counts).map(([k, v]) => ({
      stage: STAGE_LABELS[k] ?? k, key: k,
      count: v.count, value: v.value,
    }));
  }, [projects]);

  // ---- Status breakdowns (pie charts) ----
  const statusBreakdown = (key: string) => {
    const m: Record<string, number> = {};
    for (const p of projects as any[]) {
      const s = (p[key] ?? "not_started").toLowerCase();
      m[s] = (m[s] ?? 0) + 1;
    }
    return Object.entries(m).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  };

  const productionMix = useMemo(() => statusBreakdown("productionStatus"), [projects]);
  const deliveryMix   = useMemo(() => statusBreakdown("deliveryStatus"),   [projects]);
  const installMix    = useMemo(() => statusBreakdown("installationStatus"), [projects]);
  const paymentMix    = useMemo(() => statusBreakdown("paymentStatus"),    [projects]);

  // ---- Top project managers ----
  const topPMs = useMemo(() => {
    const m: Record<string, { name: string; count: number; value: number; completed: number; userId?: number }> = {};
    for (const p of projects as any[]) {
      const key = p.projectManagerName ?? `User #${p.projectManagerId ?? "—"}`;
      const e = m[key] ?? { name: key, count: 0, value: 0, completed: 0, userId: p.projectManagerId };
      e.count++;
      e.value += Number(p.projectValue ?? 0);
      if (p.stage === "completed") e.completed++;
      m[key] = e;
    }
    return Object.values(m).filter(e => e.count > 0).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [projects]);

  // ---- Active projects list (top 8 by value) ----
  const activeList = useMemo(
    () => projects.filter((p: any) => p.stage !== "completed")
      .sort((a: any, b: any) => Number(b.projectValue ?? 0) - Number(a.projectValue ?? 0))
      .slice(0, 8),
    [projects],
  );

  // ---- Activity timeline (latest 8 created or recently-updated projects) ----
  const activityFeed = useMemo(() => {
    return [...projects]
      .map((p: any) => {
        const createdAt = p.createdAt ? new Date(p.createdAt).getTime() : 0;
        const updatedAt = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
        const isUpdate = updatedAt > createdAt;
        return {
          id: p.id,
          when: Math.max(createdAt, updatedAt),
          kind: isUpdate ? "update" as const : "create" as const,
          project: p,
        };
      })
      .filter(e => e.when > 0)
      .sort((a, b) => b.when - a.when)
      .slice(0, 8);
  }, [projects]);

  // ---- Upcoming handovers (next 30 days, not yet completed) ----
  const upcomingHandovers = useMemo(() => {
    const now = Date.now();
    const horizon = 30 * 86_400_000;
    return (projects as any[])
      .filter(p => {
        if (p.stage === "completed") return false;
        if (!p.endDate) return false;
        const t = new Date(p.endDate).getTime();
        return t >= now - 7 * 86_400_000 && t <= now + horizon;
      })
      .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
      .slice(0, 8)
      .map(p => ({
        ...p,
        daysToHandover: Math.ceil((new Date(p.endDate).getTime() - now) / 86_400_000),
      }));
  }, [projects]);

  // ---- Revenue-by-project (top 8 by value, completed first) ----
  const revenueByProject = useMemo(
    () => [...projects]
      .filter((p: any) => Number(p.projectValue ?? 0) > 0)
      .sort((a: any, b: any) => Number(b.projectValue ?? 0) - Number(a.projectValue ?? 0))
      .slice(0, 8)
      .map((p: any) => ({
        name: p.projectNumber ?? p.projectName?.slice(0, 18) ?? "—",
        fullName: p.projectName,
        value: Number(p.projectValue ?? 0),
        invoiced: invoices
          .filter((i: any) => i.projectId === p.id)
          .reduce((s: number, i: any) => s + Number(i.grandTotal ?? 0), 0),
        stage: p.stage,
      })),
    [projects, invoices],
  );

  // ---- Risks ----
  const risks = useMemo(() => {
    const out: { tone: "red" | "amber" | "blue"; text: string; href?: string }[] = [];
    if (overdueProjects > 0) out.push({ tone: "red", text: `${overdueProjects} project${overdueProjects === 1 ? "" : "s"} past their end date`, href: "/projects" });
    const overdueInstall = projects.filter((p: any) => p.installationStatus === "in_progress" && p.endDate && new Date(p.endDate).getTime() < Date.now()).length;
    if (overdueInstall > 0) out.push({ tone: "amber", text: `${overdueInstall} installation${overdueInstall === 1 ? "" : "s"} running late` });
    const stuckProcurement = projects.filter((p: any) => p.procurementStatus === "pending" && p.startDate && (Date.now() - new Date(p.startDate).getTime()) > 14 * 86_400_000).length;
    if (stuckProcurement > 0) out.push({ tone: "amber", text: `${stuckProcurement} project${stuckProcurement === 1 ? "" : "s"} stuck in procurement (14+ days)` });
    const noPM = projects.filter((p: any) => !p.projectManagerId && p.stage !== "completed").length;
    if (noPM > 0) out.push({ tone: "amber", text: `${noPM} active project${noPM === 1 ? "" : "s"} without an assigned PM` });
    if (out.length === 0 && totalProjects > 0) out.push({ tone: "blue", text: "All projects on track — no critical risks detected." });
    return out.slice(0, 4);
  }, [projects, overdueProjects, totalProjects]);

  return (
    <div className="space-y-5">
      <ExecutiveHeader
        icon={Folders}
        title="Projects Command Center"
        subtitle="Production · Delivery · Installation · Handover · Payments"
      >
        <Button size="sm" variant="secondary" asChild className="bg-white/15 hover:bg-white/25 text-white border-0">
          <Link href="/projects/sales-performance"><TrendingUp className="w-4 h-4 mr-1.5" />Sales Performance</Link>
        </Button>
        <Button size="sm" asChild className="bg-white text-[#0f2d5a] hover:bg-white/90">
          <Link href="/projects"><Folders className="w-4 h-4 mr-1.5" />All Projects</Link>
        </Button>
      </ExecutiveHeader>

      {/* AI Risks */}
      {risks.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${eliteIconGrad}`} />
          <div className="flex items-center gap-2 mb-2.5">
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${eliteIconGrad} flex items-center justify-center shadow`}>
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-semibold">Project Risk Insights</h3>
            <Badge variant="secondary" className="text-[10px] bg-[#1e6ab0]/10 text-[#1e6ab0] border-0">live</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {risks.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm rounded-lg p-2 bg-muted/40">
                <div className={`w-2 h-2 rounded-full shrink-0 ${r.tone === "red" ? "bg-red-500" : r.tone === "amber" ? "bg-orange-500" : "bg-emerald-500"}`} />
                <span className="text-foreground/85">{r.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIWidget icon={Folders}      tone="blue"   label="Total Projects"     value={totalProjects}              sub={`${activeProjects} active · ${completedProjects} done`} sparkline={projectsSpark} trend={trendPct(projectsSpark)} href="/projects" testId="kpi-total-projects" />
        <KPIWidget icon={DollarSign}   tone="navy"   label="Total Value"        value={fmtAED(totalValue)}         sub={`Avg ${fmtAED(totalProjects ? totalValue / totalProjects : 0)}`} sparkline={valueSpark} trend={trendPct(valueSpark)} href="/projects" testId="kpi-total-value" />
        <KPIWidget icon={Factory}      tone="purple" label="In Production"      value={inProduction}                sub="Items being manufactured" href="/projects" testId="kpi-production" />
        <KPIWidget icon={Truck}        tone="teal"   label="In Delivery"        value={inDelivery}                  sub="On the way to site"        href="/projects" testId="kpi-delivery" />
        <KPIWidget icon={Hammer}       tone="amber"  label="In Installation"    value={inInstallation}              sub="On-site assembly"          href="/projects" testId="kpi-installation" />
        <KPIWidget icon={CheckCircle2} tone="green"  label="Completed"          value={completedProjects}            sub="Handed over to client"     sparkline={completedSpark} trend={trendPct(completedSpark)} href="/projects" testId="kpi-completed" />
        <KPIWidget icon={AlertTriangle} tone={overdueProjects > 0 ? "red" : "slate"} label="Overdue" value={overdueProjects} sub={overdueProjects > 0 ? "Past end date" : "All on schedule"} href="/projects" testId="kpi-overdue" />
        <KPIWidget icon={Target}       tone="indigo" label="Avg Progress"       value={`${Math.round(projects.reduce((s: number, p: any) => s + projectProgress(p), 0) / Math.max(1, totalProjects))}%`} sub="Across all projects" testId="kpi-progress" />
      </div>

      {/* Stage funnel */}
      <PanelCard title="Project Stage Distribution" subtitle="Count and value by current stage" icon={TrendingUp}>
        {projects.length === 0 ? (
          <Empty>No projects yet — they will appear here once created from won deals or LPOs.</Empty>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number, name: string) => name === "Value (AED)" ? fmtAED(v) : v} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left"  dataKey="count" name="Projects"    radius={[6, 6, 0, 0]}>
                {stageData.map((e, i) => <Cell key={i} fill={STAGE_COLORS[e.key] ?? "#1e6ab0"} />)}
              </Bar>
              <Bar yAxisId="right" dataKey="value" name="Value (AED)" fill={chartBlue} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </PanelCard>

      {/* Status mixes (pies) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusPie title="Production"   data={productionMix} icon={Factory} />
        <StatusPie title="Delivery"     data={deliveryMix}   icon={Truck} />
        <StatusPie title="Installation" data={installMix}    icon={Hammer} />
        <StatusPie title="Payment"      data={paymentMix}    icon={DollarSign} />
      </div>

      {/* Top PMs + Active list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${eliteIconGrad} flex items-center justify-center shadow`}>
              <Crown className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold">Top Project Managers</div>
              <div className="text-[11px] text-muted-foreground">Ranked by managed value</div>
            </div>
          </div>
          {topPMs.length === 0 ? (
            <Empty>No assigned project managers yet.</Empty>
          ) : (
            <div className="space-y-2">
              {topPMs.map((pm, i) => (
                <div key={pm.name} className="border rounded-xl p-2.5 hover:bg-muted/40 transition-all flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${i === 0 ? "bg-gradient-to-br from-orange-500 to-orange-700" : i === 1 ? "bg-gradient-to-br from-slate-400 to-slate-500" : i === 2 ? "bg-gradient-to-br from-orange-400 to-orange-800" : ""}`} style={i >= 3 ? { background: chartBlue } : undefined}>
                    {i + 1}
                  </div>
                  <Avatar name={pm.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{pm.name}</div>
                    <div className="text-[11px] text-muted-foreground">{pm.count} projects · {pm.completed} done</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-[#0f2d5a] dark:text-white">{fmtAED(pm.value)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-card border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Folders className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-semibold">Active Projects · Top 8 by Value</div>
                <div className="text-[11px] text-muted-foreground">Live progress across stages</div>
              </div>
            </div>
            <Link href="/projects" className="text-[11px] text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {activeList.length === 0 ? (
            <Empty>No active projects right now.</Empty>
          ) : (
            <div className="space-y-2">
              {activeList.map((p: any) => {
                const pct = projectProgress(p);
                const overdue = p.endDate && new Date(p.endDate).getTime() < Date.now();
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} className="block">
                    <div className="border rounded-xl p-3 hover:bg-muted/40 hover:border-[#1e6ab0]/40 transition-all">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-mono text-primary">{p.projectNumber}</span>
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {STAGE_LABELS[p.stage] ?? p.stage}
                        </Badge>
                        {overdue && <Badge className="text-[10px] bg-red-100 text-red-700">Overdue</Badge>}
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate">{p.projectName}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {p.clientName} {p.location && <><MapPin className="w-3 h-3 inline" /> {p.location}</>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-[#0f2d5a] dark:text-white">{fmtAED(Number(p.projectValue ?? 0))}</div>
                          <div className="text-[10px] text-muted-foreground">{p.projectManagerName ?? "Unassigned"}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="text-[10px] font-mono text-muted-foreground w-9 text-right">{pct}%</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming handovers + Revenue by project */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PanelCard title="Upcoming Handovers" subtitle="Next 30 days · scheduled completions" icon={Calendar}>
          {upcomingHandovers.length === 0 ? (
            <Empty>No handovers scheduled in the next 30 days.</Empty>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto" data-testid="list-handovers">
              {upcomingHandovers.map((p: any) => {
                const overdue = p.daysToHandover < 0;
                const soon    = p.daysToHandover >= 0 && p.daysToHandover <= 7;
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} className="block">
                    <div className="border rounded-xl p-2.5 hover:bg-muted/40 hover:border-[#1e6ab0]/40 transition-all flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 text-white ${overdue ? "bg-red-500" : soon ? "bg-orange-500" : ""}`} style={!overdue && !soon ? { background: chartBlue } : undefined}>
                        <span className="text-xs font-bold leading-none">{Math.abs(p.daysToHandover)}d</span>
                        <span className="text-[9px] leading-none mt-0.5">{overdue ? "late" : "to go"}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{p.projectName}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {p.projectNumber} · {p.clientName} · {STAGE_LABELS[p.stage] ?? p.stage}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-[#0f2d5a] dark:text-white">{fmtAED(Number(p.projectValue ?? 0))}</div>
                        <div className="text-[10px] text-muted-foreground">{new Date(p.endDate).toLocaleDateString("en-AE", { day: "2-digit", month: "short" })}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </PanelCard>

        <PanelCard title="Revenue by Project" subtitle="Top 8 projects · contract value vs invoiced" icon={DollarSign}>
          {revenueByProject.length === 0 ? (
            <Empty>No project revenue recorded yet.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={revenueByProject} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
                <Tooltip
                  formatter={(v: number) => fmtAED(v)}
                  labelFormatter={(_, p: any) => p?.[0]?.payload?.fullName ?? ""}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="value"    name="Contract value" fill={chartBlue} radius={[0, 4, 4, 0]} />
                <Bar dataKey="invoiced" name="Invoiced"       fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </PanelCard>
      </div>

      {/* Activity Timeline */}
      <PanelCard title="Recent Project Activity" subtitle="Latest creations & stage updates" icon={TrendingUp}>
        {activityFeed.length === 0 ? (
          <Empty>No project activity yet.</Empty>
        ) : (
          <div className="relative pl-4 space-y-3" data-testid="timeline-projects">
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
            {activityFeed.map(e => {
              const p = e.project;
              const isUpdate = e.kind === "update";
              return (
                <Link key={`${e.kind}-${e.id}`} href={`/projects/${p.id}`} className="block relative">
                  <div className={`absolute -left-4 top-2 w-3.5 h-3.5 rounded-full border-2 border-card ${isUpdate ? "" : "bg-emerald-500"}`} style={isUpdate ? { background: chartBlue } : undefined} />
                  <div className="border rounded-xl p-2.5 hover:bg-muted/40 hover:border-[#1e6ab0]/40 transition-all">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-mono text-primary">{p.projectNumber}</span>
                      <Badge variant="secondary" className="text-[10px] capitalize">{STAGE_LABELS[p.stage] ?? p.stage}</Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {isUpdate ? "Updated" : "Created"} · {new Date(e.when).toLocaleDateString("en-AE", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                    <div className="text-sm font-medium truncate">{p.projectName}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {p.clientName} · {p.projectManagerName ?? "Unassigned"} · {fmtAED(Number(p.projectValue ?? 0))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </PanelCard>

      {/* Footer stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <FooterStat icon={Trophy}     label="Won LPOs" value={lpos.length}           sub={fmtAED(lpos.reduce((s: number, l: any) => s + Number(l.lpoValue ?? 0), 0))} href="/sales/lpos" />
        <FooterStat icon={DollarSign} label="Invoices"  value={invoices.length}      sub={fmtAED(invoices.reduce((s: number, i: any) => s + Number(i.grandTotal ?? 0), 0))} href="/accounts/invoices" />
        <FooterStat icon={Truck}      label="Delivery Notes" value={dns.length}      sub="Issued"  href="/accounts/delivery-notes" />
        <FooterStat icon={HardHat}    label="Sales Reps" value={users.filter((u: any) => (u.role ?? "").toLowerCase().includes("sales")).length} sub="Active accounts" href="/admin/users" />
      </div>
    </div>
  );
}

function PanelCard({ title, subtitle, icon: Icon, children, className = "" }: {
  title: string; subtitle?: string; icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-card border rounded-2xl p-4 space-y-3 shadow-sm ${className}`}>
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

function StatusPie({ title, data, icon: Icon }: { title: string; data: { name: string; value: number }[]; icon: React.ComponentType<{ className?: string }> }) {
  const COLORS = ["#1e6ab0", "#0f2d5a", "#10b981", "#f97316", "#8b5cf6", "#06b6d4", "#ef4444", "#64748b"];
  return (
    <PanelCard title={title} icon={Icon}>
      {data.length === 0 ? (
        <Empty>No data</Empty>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <RPieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={32} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 10 }} />
          </RPieChart>
        </ResponsiveContainer>
      )}
    </PanelCard>
  );
}

function FooterStat({ icon: Icon, label, value, sub, href }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; sub?: string; href: string }) {
  return (
    <Link href={href} className="block">
      <div className="bg-card border rounded-xl p-3 hover:bg-muted/40 hover:border-[#1e6ab0]/40 transition-all">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-[#1e6ab0]" />
          <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{label}</div>
        </div>
        <div className="text-xl font-bold">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
      </div>
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground italic py-6 text-center">{children}</div>;
}
