import { useMemo } from "react";
import { Link } from "wouter";
import { useListAssets } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, PieChart as RPieChart, Pie, Cell,
} from "recharts";
import {
  Wrench, AlertTriangle, CheckCircle2, MapPin, DollarSign,
  TrendingUp, ArrowRight, Sparkles, Calendar, Activity, ShieldCheck,
} from "lucide-react";
import {
  ExecutiveHeader, KPIWidget, weeklyValues, trendPct,
} from "@/components/crm/premium";

const PALETTE = ["#1e6ab0", "#0f2d5a", "#10b981", "#f97316", "#8b5cf6", "#06b6d4", "#ef4444", "#14b8a6", "#a855f7", "#64748b"];

const STATUS_COLORS: Record<string, string> = {
  in_use:        "#10b981",
  available:     "#1e6ab0",
  maintenance:   "#f97316",
  retired:       "#64748b",
  damaged:       "#ef4444",
  out_of_service: "#ef4444",
};

const CONDITION_COLORS: Record<string, string> = {
  excellent:  "#10b981",
  good:       "#1e6ab0",
  fair:       "#f97316",
  poor:       "#ef4444",
  damaged:    "#ef4444",
};

function fmtAED(v: number): string {
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `AED ${(v / 1_000).toFixed(0)}k`;
  return `AED ${Math.round(v).toLocaleString()}`;
}

function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (!isFinite(t)) return null;
  return Math.round((t - Date.now()) / 86_400_000);
}

export function AssetsDashboard() {
  const { filterByCompany } = useActiveCompany();
  const { data: assetsRaw } = useListAssets({});

  const assets = useMemo(() => filterByCompany(assetsRaw ?? []), [assetsRaw, filterByCompany]);

  // ---- KPIs ----
  const totalAssets       = assets.length;
  const totalValue        = assets.reduce((s: number, a: any) => s + Number(a.purchaseValue ?? 0), 0);
  const inUseCount        = assets.filter((a: any) => (a.status ?? "").toLowerCase() === "in_use").length;
  const availableCount    = assets.filter((a: any) => (a.status ?? "").toLowerCase() === "available").length;
  const maintenanceCount  = assets.filter((a: any) => (a.status ?? "").toLowerCase() === "maintenance").length;
  const retiredCount      = assets.filter((a: any) => (a.status ?? "").toLowerCase() === "retired").length;
  const damagedCount      = assets.filter((a: any) => ["damaged", "out_of_service"].includes((a.status ?? "").toLowerCase())).length;
  const utilization       = totalAssets > 0 ? Math.round((inUseCount / totalAssets) * 100) : 0;

  // Maintenance flags
  const overdueMaintenance = useMemo(() => assets.filter((a: any) => {
    const d = daysUntil(a.maintenanceDate);
    return d != null && d < 0 && (a.status ?? "").toLowerCase() !== "retired";
  }), [assets]);
  const dueSoonMaintenance = useMemo(() => assets.filter((a: any) => {
    const d = daysUntil(a.maintenanceDate);
    return d != null && d >= 0 && d <= 14 && (a.status ?? "").toLowerCase() !== "retired";
  }), [assets]);

  const assetsSpark = useMemo(() => weeklyValues(assets, "createdAt", () => 1, 8), [assets]);
  const valueSpark  = useMemo(() => weeklyValues(assets, "createdAt", (a: any) => Number(a.purchaseValue ?? 0), 8), [assets]);

  // ---- Distributions ----
  const categoryMix = useMemo(() => {
    const m: Record<string, { count: number; value: number }> = {};
    for (const a of assets as any[]) {
      const k = a.category ?? "Other";
      const e = m[k] ?? { count: 0, value: 0 };
      e.count++;
      e.value += Number(a.purchaseValue ?? 0);
      m[k] = e;
    }
    return Object.entries(m).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value);
  }, [assets]);

  const statusMix = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of assets as any[]) {
      const k = (a.status ?? "available").toLowerCase();
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([k, value]) => ({ name: k.replace(/_/g, " "), key: k, value }));
  }, [assets]);

  const conditionMix = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of assets as any[]) {
      const k = (a.condition ?? "good").toLowerCase();
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([k, value]) => ({ name: k.replace(/_/g, " "), key: k, value }));
  }, [assets]);

  const locationMix = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of assets as any[]) {
      const k = a.currentLocation ?? "—";
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [assets]);

  // ---- Insights ----
  const insights = useMemo(() => {
    const out: { tone: "red" | "amber" | "blue"; text: string }[] = [];
    if (overdueMaintenance.length > 0) out.push({ tone: "red", text: `${overdueMaintenance.length} asset${overdueMaintenance.length === 1 ? "" : "s"} overdue for maintenance` });
    if (damagedCount > 0) out.push({ tone: "red", text: `${damagedCount} asset${damagedCount === 1 ? "" : "s"} damaged or out of service` });
    if (dueSoonMaintenance.length > 0) out.push({ tone: "amber", text: `${dueSoonMaintenance.length} asset${dueSoonMaintenance.length === 1 ? "" : "s"} need maintenance within 14 days` });
    const idle = availableCount;
    if (totalAssets > 0 && idle > totalAssets * 0.3) out.push({ tone: "amber", text: `${idle} assets idle — utilization at ${utilization}%` });
    if (out.length === 0 && totalAssets > 0) out.push({ tone: "blue", text: "Asset register healthy — no maintenance issues." });
    return out.slice(0, 4);
  }, [overdueMaintenance, dueSoonMaintenance, damagedCount, availableCount, utilization, totalAssets]);

  return (
    <div className="space-y-5">
      <ExecutiveHeader
        icon={Wrench}
        title="Asset Command Center"
        subtitle="Register · Utilization · Condition · Maintenance · Value"
      >
        <Button size="sm" asChild className="bg-white text-[#0f2d5a] hover:bg-white/90">
          <Link href="/assets"><Wrench className="w-4 h-4 mr-1.5" />Asset Register</Link>
        </Button>
      </ExecutiveHeader>

      {insights.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#0f2d5a] to-[#1e6ab0]" />
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] flex items-center justify-center shadow">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-semibold">Asset Insights</h3>
            <Badge variant="secondary" className="text-[10px] bg-[#1e6ab0]/10 text-[#1e6ab0] border-0">live</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {insights.map((r, idx) => (
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
        <KPIWidget icon={Wrench}      tone="navy"   label="Total Assets"      value={totalAssets}       sub={`${categoryMix.length} categories`}           sparkline={assetsSpark} trend={trendPct(assetsSpark)} href="/assets" testId="kpi-assets" />
        <KPIWidget icon={DollarSign}  tone="blue"   label="Total Value"       value={fmtAED(totalValue)} sub={`Avg ${fmtAED(totalAssets ? totalValue / totalAssets : 0)}`} sparkline={valueSpark} trend={trendPct(valueSpark)} href="/assets" testId="kpi-value" />
        <KPIWidget icon={Activity}    tone="green"  label="In Use"            value={inUseCount}        sub={`${utilization}% utilization`}                href="/assets" testId="kpi-inuse" />
        <KPIWidget icon={CheckCircle2} tone="teal"  label="Available"         value={availableCount}    sub="Ready for assignment"                          href="/assets" testId="kpi-available" />
        <KPIWidget icon={Wrench}      tone="amber"  label="Under Maintenance" value={maintenanceCount}  sub={`${dueSoonMaintenance.length} due in 14 days`} href="/assets" testId="kpi-maintenance" />
        <KPIWidget icon={AlertTriangle} tone={overdueMaintenance.length > 0 ? "red" : "slate"} label="Overdue Maint." value={overdueMaintenance.length} sub="Past schedule" href="/assets" testId="kpi-overdue" />
        <KPIWidget icon={ShieldCheck} tone="purple" label="Retired"           value={retiredCount}      sub="End of life"                                   href="/assets" testId="kpi-retired" />
        <KPIWidget icon={AlertTriangle} tone={damagedCount > 0 ? "red" : "slate"} label="Damaged" value={damagedCount} sub="Out of service" href="/assets" testId="kpi-damaged" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PanelCard title="By Category" subtitle="Count + invested value" icon={Wrench} className="lg:col-span-2">
          {categoryMix.length === 0 ? (
            <Empty>No assets registered yet.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categoryMix}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number, name: string) => name === "Value (AED)" ? fmtAED(v) : v} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left"  dataKey="count" name="Count"        fill="#1e6ab0" radius={[6, 6, 0, 0]} />
                <Bar yAxisId="right" dataKey="value" name="Value (AED)"  fill="#0f2d5a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </PanelCard>

        <PanelCard title="Status Mix" subtitle="Operational status breakdown" icon={Activity}>
          {statusMix.length === 0 ? (
            <Empty>No assets yet.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <RPieChart>
                <Pie data={statusMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                  {statusMix.map((e, i) => <Cell key={i} fill={STATUS_COLORS[e.key] ?? PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </RPieChart>
            </ResponsiveContainer>
          )}
        </PanelCard>
      </div>

      {/* Condition + locations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PanelCard title="Condition" subtitle="Health rating distribution" icon={ShieldCheck}>
          {conditionMix.length === 0 ? (
            <Empty>No condition recorded.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={conditionMix}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" name="Assets" radius={[6, 6, 0, 0]}>
                  {conditionMix.map((e, i) => <Cell key={i} fill={CONDITION_COLORS[e.key] ?? PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </PanelCard>

        <PanelCard title="Locations" subtitle="Where assets are deployed" icon={MapPin}>
          {locationMix.length === 0 ? (
            <Empty>No locations recorded.</Empty>
          ) : (
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
              {locationMix.map((l, i) => {
                const max = locationMix[0].value;
                return (
                  <div key={l.name} className="flex items-center gap-2">
                    <div className="text-xs font-medium truncate flex-1 min-w-0">{l.name}</div>
                    <div className="h-1.5 w-32 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#0f2d5a] to-[#1e6ab0]" style={{ width: `${(l.value / max) * 100}%` }} />
                    </div>
                    <div className="text-xs font-semibold w-8 text-right">{l.value}</div>
                  </div>
                );
              })}
            </div>
          )}
        </PanelCard>
      </div>

      {/* Maintenance schedule */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <div className="text-sm font-semibold">Maintenance Schedule</div>
              <div className="text-[11px] text-muted-foreground">Overdue + upcoming within 14 days</div>
            </div>
          </div>
          <Link href="/assets" className="text-[11px] text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {[...overdueMaintenance, ...dueSoonMaintenance].length === 0 ? (
          <Empty>No assets need attention right now.</Empty>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[...overdueMaintenance, ...dueSoonMaintenance].slice(0, 10).map((a: any) => {
              const days = daysUntil(a.maintenanceDate);
              const overdue = days != null && days < 0;
              return (
                <Link key={a.id} href="/assets" className="block">
                  <div className={`border rounded-xl p-3 hover:bg-muted/40 transition-all flex items-center gap-3 ${overdue ? "border-red-300/60" : "border-orange-300/40"}`}>
                    <div className={`w-1.5 h-9 rounded-full shrink-0 ${overdue ? "bg-red-500" : "bg-orange-500"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-primary">{a.assetId}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">{(a.condition ?? "—").replace(/_/g, " ")}</span>
                      </div>
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {a.category} · {a.currentLocation ?? "—"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge className={overdue ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}>
                        {overdue ? `${Math.abs(days!)}d overdue` : `Due in ${days}d`}
                      </Badge>
                      {a.maintenanceDate && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(a.maintenanceDate).toLocaleDateString("en-AE", { day: "2-digit", month: "short" })}</div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* High-value assets */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-semibold">Top 8 Assets by Purchase Value</div>
            <div className="text-[11px] text-muted-foreground">Your biggest investments</div>
          </div>
        </div>
        {assets.length === 0 ? (
          <Empty>No assets yet.</Empty>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {[...assets].sort((a: any, b: any) => Number(b.purchaseValue ?? 0) - Number(a.purchaseValue ?? 0)).slice(0, 8).map((a: any) => (
              <Link key={a.id} href="/assets" className="block">
                <div className="border rounded-xl p-3 hover:bg-muted/40 hover:border-[#1e6ab0]/40 transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-primary">{a.assetId}</span>
                    <Badge variant="secondary" className="text-[10px] capitalize">{(a.status ?? "—").replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="text-sm font-semibold truncate">{a.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{a.category}</div>
                  <div className="text-sm font-bold text-[#0f2d5a] dark:text-white mt-1">{fmtAED(Number(a.purchaseValue ?? 0))}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
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

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground italic py-6 text-center">{children}</div>;
}
