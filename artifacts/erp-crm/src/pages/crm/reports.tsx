import { useMemo } from "react";
import { Link } from "wouter";
import {
  useListLeads, useListDeals, useListUsers, useListQuotations,
} from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Button } from "@/components/ui/button";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";
import {
  BarChart3, Trophy, Target, TrendingUp, Briefcase, Users, DollarSign, Percent, Activity,
} from "lucide-react";
import { ExecutiveHeader, KPIWidget } from "@/components/crm/premium";

const SOURCE_COLORS = ["#0f2d5a", "#1e6ab0", "#3b82f6", "#10b981", "#f97316", "#ef4444", "#8b5cf6", "#64748b"];
const FUNNEL_STAGES = [
  { key: "new",           label: "New",           color: "#3b82f6" },
  { key: "qualification", label: "Qualified",     color: "#8b5cf6" },
  { key: "proposal",      label: "Proposal",      color: "#f97316" },
  { key: "negotiation",   label: "Negotiation",   color: "#fb923c" },
  { key: "won",           label: "Won",           color: "#10b981" },
];

export function CRMReports() {
  const { data: leadsRaw } = useListLeads({});
  const { data: dealsRaw } = useListDeals();
  const { data: quotationsRaw } = useListQuotations();
  const { data: users } = useListUsers();
  const { filterByCompany } = useActiveCompany();

  const leads = useMemo(() => filterByCompany(leadsRaw ?? []), [leadsRaw, filterByCompany]);
  const deals = useMemo(() => filterByCompany(dealsRaw ?? []), [dealsRaw, filterByCompany]);
  const quotations = useMemo(() => filterByCompany(quotationsRaw ?? []), [quotationsRaw, filterByCompany]);

  // KPIs
  const wonValue = deals.filter(d => d.stage === "won").reduce((s, d) => s + Number(d.value ?? 0), 0);
  const pipelineValue = deals.filter(d => !["won", "lost"].includes(d.stage)).reduce((s, d) => s + Number(d.value ?? 0), 0);
  const wonDeals = deals.filter(d => d.stage === "won").length;
  const lostDeals = deals.filter(d => d.stage === "lost").length;
  const closedDeals = wonDeals + lostDeals;
  const winRate = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0;
  const avgDealSize = wonDeals > 0 ? Math.round(wonValue / wonDeals) : 0;
  const wonLeads = leads.filter(l => l.status === "won").length;
  const conversionRate = leads.length > 0 ? Math.round((wonLeads / leads.length) * 100) : 0;
  const quotationValue = quotations.reduce((s, q: any) => s + Number(q.grandTotal ?? 0), 0);

  // --- Funnel: count of leads ever in each stage; for now use the live lead/deal status mix
  const funnelData = useMemo(() => {
    const total = leads.length || 1;
    return FUNNEL_STAGES.map(s => {
      let count = 0;
      if (s.key === "new") count = leads.length;
      else if (s.key === "qualification") count = leads.filter(l => !["new", "lost"].includes(l.status)).length;
      else if (s.key === "proposal") count = leads.filter(l => ["quotation_sent", "quotation_required", "negotiation", "won"].includes(l.status)).length
                                            + deals.filter(d => ["proposal", "negotiation", "won"].includes(d.stage)).length;
      else if (s.key === "negotiation") count = leads.filter(l => ["negotiation", "won"].includes(l.status)).length
                                              + deals.filter(d => ["negotiation", "won"].includes(d.stage)).length;
      else if (s.key === "won") count = leads.filter(l => l.status === "won").length + deals.filter(d => d.stage === "won").length;
      return { ...s, count, pct: Math.round((count / total) * 100) };
    });
  }, [leads, deals]);

  // --- Source mix (donut)
  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leads) counts[l.source ?? "other"] = (counts[l.source ?? "other"] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  }, [leads]);

  // --- Won/Lost donut
  const winLossData = useMemo(() => {
    if (closedDeals === 0) return [];
    return [
      { name: "Won",  value: wonDeals,  color: "#10b981" },
      { name: "Lost", value: lostDeals, color: "#ef4444" },
    ];
  }, [wonDeals, lostDeals, closedDeals]);

  // --- Sales by user (won AED per assignedToId)
  const userMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const u of users ?? []) m.set(u.id, u.name ?? `User #${u.id}`);
    return m;
  }, [users]);

  const salesByUser = useMemo(() => {
    const totals = new Map<number, { won: number; pipeline: number }>();
    for (const d of deals) {
      const uid = (d as any).assignedToId as number | null | undefined;
      if (!uid) continue;
      const cur = totals.get(uid) ?? { won: 0, pipeline: 0 };
      const v = Number(d.value ?? 0);
      if (d.stage === "won") cur.won += v;
      else if (!["lost"].includes(d.stage)) cur.pipeline += v;
      totals.set(uid, cur);
    }
    const arr = Array.from(totals.entries()).map(([uid, t]) => ({
      name: userMap.get(uid) ?? `User #${uid}`,
      Won: Math.round(t.won),
      Pipeline: Math.round(t.pipeline),
    }));
    arr.sort((a, b) => (b.Won + b.Pipeline) - (a.Won + a.Pipeline));
    return arr.slice(0, 8);
  }, [deals, userMap]);

  // --- Monthly trend (last 6 months) — won value by close month
  const monthlyTrend = useMemo(() => {
    const buckets: { key: string; label: string; Won: number; Pipeline: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-AE", { month: "short" }),
        Won: 0,
        Pipeline: 0,
      });
    }
    const idxOf = (date: string | Date | null | undefined) => {
      if (!date) return -1;
      const dt = new Date(date);
      const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      return buckets.findIndex(b => b.key === k);
    };
    for (const d of deals) {
      const v = Number(d.value ?? 0);
      if (d.stage === "won") {
        const i = idxOf((d as any).updatedAt ?? (d as any).expectedCloseDate ?? d.createdAt);
        if (i >= 0) buckets[i].Won += v;
      } else if (!["lost"].includes(d.stage)) {
        const i = idxOf((d as any).expectedCloseDate ?? d.createdAt);
        if (i >= 0) buckets[i].Pipeline += v;
      }
    }
    return buckets.map(b => ({ ...b, Won: Math.round(b.Won), Pipeline: Math.round(b.Pipeline) }));
  }, [deals]);

  return (
    <div className="space-y-5">
      <ExecutiveHeader
        icon={BarChart3}
        title="CRM Analytics & Reports"
        subtitle="Pipeline performance, conversion funnel and sales-team leaderboard"
      >
        <Button variant="secondary" size="sm" asChild className="bg-white/15 hover:bg-white/25 text-white border-0">
          <Link href="/crm/pipeline"><Briefcase className="w-4 h-4 mr-1.5" />Pipeline</Link>
        </Button>
        <Button variant="secondary" size="sm" asChild className="bg-white/15 hover:bg-white/25 text-white border-0">
          <Link href="/crm/leaderboard"><Trophy className="w-4 h-4 mr-1.5" />Leaderboard</Link>
        </Button>
      </ExecutiveHeader>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIWidget icon={DollarSign} tone="green"  label="Won Revenue"   value={`AED ${(wonValue / 1000).toFixed(0)}k`}      sub={`${wonDeals} deals closed`} testId="report-won" />
        <KPIWidget icon={TrendingUp} tone="blue"   label="Open Pipeline" value={`AED ${(pipelineValue / 1000).toFixed(0)}k`} sub={`${deals.length - closedDeals} open deals`} testId="report-pipeline" />
        <KPIWidget icon={Percent}    tone="purple" label="Win Rate"      value={`${winRate}%`}                                sub={`${wonDeals}/${closedDeals || 0} closed`} testId="report-winrate" />
        <KPIWidget icon={Target}     tone="amber"  label="Avg Deal Size" value={`AED ${(avgDealSize / 1000).toFixed(0)}k`}    sub="Won deals only" testId="report-avg" />
        <KPIWidget icon={Users}      tone="indigo" label="Conversion"    value={`${conversionRate}%`} sub={`${wonLeads}/${leads.length} leads`} testId="report-conversion" />
        <KPIWidget icon={Activity}   tone="teal"   label="Quotation Value" value={`AED ${(quotationValue / 1000).toFixed(0)}k`} sub={`${quotations.length} quotations`} testId="report-quote" />
        <KPIWidget icon={Briefcase}  tone="slate"  label="Total Deals"   value={deals.length}                                  sub={`${lostDeals} lost`} testId="report-deals" />
        <KPIWidget icon={Trophy}     tone="red"    label="Hot Leads"     value={leads.filter(l => l.leadScore === "hot").length} sub={`${leads.length} total`} testId="report-hot" />
      </div>

      {/* Conversion Funnel */}
      <div className="bg-card border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] flex items-center justify-center shadow">
            <Target className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold">Conversion Funnel</div>
            <div className="text-[11px] text-muted-foreground">Drop-off across each pipeline stage</div>
          </div>
        </div>
        {leads.length === 0 ? (
          <div className="text-xs text-muted-foreground italic py-8 text-center">Add some leads to see the funnel.</div>
        ) : (
          <div className="space-y-2">
            {funnelData.map((s, i) => {
              const widthPct = Math.max(s.pct, 3);
              return (
                <div key={s.key} className="group relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-muted text-[11px] font-semibold flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm font-medium">{s.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-bold text-foreground mr-1.5">{s.count}</span>
                      <span className="font-semibold">{s.pct}%</span>
                    </div>
                  </div>
                  <div className="h-7 bg-muted/40 rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg transition-all duration-500 group-hover:brightness-110"
                      style={{ width: `${widthPct}%`, background: `linear-gradient(90deg, ${s.color}, ${s.color}cc)` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-semibold">Lead Source Mix</div>
              <div className="text-[11px] text-muted-foreground">Where leads originated</div>
            </div>
          </div>
          {sourceData.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-8 text-center">No leads yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
                  {sourceData.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-sm font-semibold">Win / Loss Ratio</div>
              <div className="text-[11px] text-muted-foreground">{closedDeals} closed deals</div>
            </div>
          </div>
          {winLossData.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-8 text-center">No closed deals yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={winLossData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={55} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {winLossData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Sales by user (bar) */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <div className="text-sm font-semibold">Sales by Salesperson</div>
            <div className="text-[11px] text-muted-foreground">Won vs. open pipeline (AED)</div>
          </div>
        </div>
        {salesByUser.length === 0 ? (
          <div className="text-xs text-muted-foreground italic py-8 text-center">Assign deals to salespeople to populate.</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, salesByUser.length * 36)}>
            <BarChart data={salesByUser} layout="vertical" margin={{ left: 24, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
              <Tooltip formatter={(v: number) => `AED ${v.toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Won" stackId="a" fill="#10b981" radius={[0, 6, 6, 0]} />
              <Bar dataKey="Pipeline" stackId="a" fill="#1e6ab0" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly trend (line) */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <div className="text-sm font-semibold">Revenue Trend (Last 6 months)</div>
            <div className="text-[11px] text-muted-foreground">Won revenue vs. expected pipeline</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => `AED ${Number(v).toLocaleString()}`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="Won" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="Pipeline" stroke="#1e6ab0" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
