import { useMemo } from "react";
  import { Link } from "wouter";
  import { useListLeads, useListUsers } from "@workspace/api-client-react";
  import { useActiveCompany } from "@/hooks/useActiveCompany";
  import { Badge } from "@/components/ui/badge";
  import { Button } from "@/components/ui/button";
  import { Trophy, TrendingUp, Users, Award, Target, ArrowRight, Crown, Star, Medal, BarChart3 } from "lucide-react";
  import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

  interface Row {
    id: number; name: string; role: string;
    leads: number; hotLeads: number;
    activeLeads: number; wonLeads: number;
    wonValue: number; pipelineValue: number;
    conversion: number; score: number;
  }

  export function SalesLeaderboard() {
    const { data: leadsRaw } = useListLeads({});
    const { data: usersRaw } = useListUsers();
    const { filterByCompany } = useActiveCompany();

    const leads = useMemo(() => filterByCompany(leadsRaw ?? []), [leadsRaw, filterByCompany]);
    const users = (usersRaw ?? []).filter((u: any) =>
      ["sales", "sales_manager", "manager", "main_admin", "admin"].includes((u.role ?? "").toLowerCase())
      || (u.role ?? "").toLowerCase().includes("sales"),
    );

    const rows: Row[] = useMemo(() => {
      return users.map((u: any) => {
        const myLeads = (leads as any[]).filter(l => l.assignedToId === u.id);
        const won = myLeads.filter(l => l.status === "won");
        const active = myLeads.filter(l => !["won", "lost"].includes(l.status));
        const wonValue = won.reduce((s, l) => s + Number(l.budget ?? 0), 0);
        const pipelineValue = active.reduce((s, l) => s + Number(l.budget ?? 0), 0);
        const conversion = myLeads.length > 0 ? Math.round((won.length / myLeads.length) * 100) : 0;
        const conversionWeight = myLeads.length >= 5 ? conversion : 0;
        const score = Math.round(wonValue / 1000) + won.length * 50 + active.length * 10 + conversionWeight;
        return {
          id: u.id, name: u.name, role: u.role,
          leads: myLeads.length, hotLeads: myLeads.filter(l => l.leadScore === "hot").length,
          activeLeads: active.length, wonLeads: won.length,
          wonValue, pipelineValue, conversion, score,
        };
      }).sort((a: Row, b: Row) => b.score - a.score);
    }, [users, leads]);

    const top = rows[0];
    const totalWon = rows.reduce((s, r) => s + r.wonValue, 0);
    const teamPipeline = rows.reduce((s, r) => s + r.pipelineValue, 0);
    const teamLeads = rows.reduce((s, r) => s + r.leads, 0);

    const chartData = rows.slice(0, 8).map(r => ({
      name: r.name.split(" ")[0], Won: r.wonValue, Pipeline: r.pipelineValue,
    }));

    const medal = (rank: number) =>
      rank === 0 ? { icon: Crown, className: "bg-orange-500 text-white" } :
      rank === 1 ? { icon: Medal, className: "bg-slate-400 text-white" } :
      rank === 2 ? { icon: Award, className: "bg-orange-700 text-white" } :
                    { icon: Star, className: "bg-muted text-muted-foreground" };

    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Trophy className="w-5 h-5 text-orange-500" />Sales Leaderboard</h1>
            <p className="text-muted-foreground text-sm">Salesperson performance — ranked by composite score (won value, leads closed).</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild><Link href="/crm"><ArrowRight className="w-4 h-4 mr-1.5 rotate-180" />Back to CRM</Link></Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Users} label="Team size" value={rows.length} tone="blue" />
          <StatCard icon={Target} label="Team leads" value={teamLeads} tone="indigo" />
          <StatCard icon={TrendingUp} label="Open pipeline" value={`AED ${(teamPipeline / 1000).toFixed(0)}k`} tone="amber" />
          <StatCard icon={Trophy} label="Total won" value={`AED ${(totalWon / 1000).toFixed(0)}k`} tone="green" />
        </div>

        {top && top.score > 0 && (
          <div className="bg-gradient-to-r from-[#0f2d5a] to-[#1e6ab0] rounded-xl p-5 text-white flex items-center gap-4 flex-wrap">
            <div className="w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center shadow-lg"><Crown className="w-7 h-7 text-white" /></div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider text-white/70">Top Performer</div>
              <div className="text-xl font-bold truncate">{top.name}</div>
              <div className="text-xs text-white/80 capitalize">{top.role.replace(/_/g, " ")}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <Stat label="Won leads" value={top.wonLeads} />
              <Stat label="Won value" value={`AED ${(top.wonValue / 1000).toFixed(0)}k`} />
              <Stat label="Conversion" value={`${top.conversion}%`} />
            </div>
          </div>
        )}

        {chartData.length > 0 && (
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-blue-600" /><h3 className="text-sm font-semibold">Won vs Open Pipeline (top 8)</h3></div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `AED ${v.toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Won" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pipeline" fill="#1e6ab0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">Salesperson Ranking</h3>
            <span className="text-xs text-muted-foreground">{rows.length} salespeople</span>
          </div>
          {rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground italic">No sales users yet.</div>
          ) : (
            <div className="divide-y">
              {rows.map((r, i) => {
                const m = medal(i);
                return (
                  <div key={r.id} className="p-3 flex items-center gap-3 hover:bg-muted/30" data-testid={`leaderboard-row-${r.id}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${m.className}`}><m.icon className="w-4 h-4" /></div>
                    <div className="text-2xl font-bold w-8 text-right text-muted-foreground/60">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-sm truncate">{r.name}</div>
                        <Badge variant="outline" className="capitalize text-[10px]">{r.role.replace(/_/g, " ")}</Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{r.leads} leads · {r.hotLeads} hot</div>
                    </div>
                    <div className="hidden md:grid grid-cols-4 gap-3 text-xs text-right">
                      <Stat label="Active" value={r.activeLeads} small />
                      <Stat label="Won" value={r.wonLeads} small />
                      <Stat label="Won value" value={`AED ${(r.wonValue / 1000).toFixed(0)}k`} small />
                      <Stat label="Conv." value={`${r.conversion}%`} small />
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-[#1e6ab0]">{r.score}</div>
                      <div className="text-[10px] text-muted-foreground">score</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  function StatCard({ icon: Icon, label, value, tone }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string; value: number | string; tone: "blue" | "indigo" | "amber" | "green";
  }) {
    const colors = { blue:"bg-blue-100 text-blue-700", indigo:"bg-indigo-100 text-indigo-700", amber:"bg-orange-100 text-orange-700", green:"bg-emerald-100 text-emerald-700" }[tone];
    return (
      <div className="bg-card border rounded-xl p-3 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors}`}><Icon className="w-5 h-5" /></div>
        <div><div className="text-xl font-bold leading-none">{value}</div><div className="text-xs text-muted-foreground mt-1">{label}</div></div>
      </div>
    );
  }

  function Stat({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
    return (
      <div>
        <div className={small ? "text-xs font-bold" : "text-base font-bold"}>{value}</div>
        <div className="text-[10px] text-muted-foreground/80">{label}</div>
      </div>
    );
  }
  