import { useListLeads } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, TrendingUp } from "lucide-react";

const STAGES = [
  { key: "new", label: "New", color: "bg-blue-500" },
  { key: "contacted", label: "Contacted", color: "bg-indigo-500" },
  { key: "qualified", label: "Qualified", color: "bg-purple-500" },
  { key: "site_visit", label: "Site Visit", color: "bg-teal-500" },
  { key: "quotation_required", label: "Quot. Required", color: "bg-amber-500" },
  { key: "quotation_sent", label: "Quot. Sent", color: "bg-orange-500" },
  { key: "negotiation", label: "Negotiation", color: "bg-pink-500" },
  { key: "won", label: "Won", color: "bg-green-500" },
  { key: "lost", label: "Lost", color: "bg-red-500" },
];

const scoreColors: Record<string, string> = {
  hot: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  warm: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  cold: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export function SalesPipelineReport() {
  const { data: leads, isLoading } = useListLeads();

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading report...</div>;

  const total = leads?.length ?? 0;
  const won = leads?.filter(l => l.status === "won").length ?? 0;
  const hot = leads?.filter(l => l.leadScore === "hot").length ?? 0;
  const conversionRate = total > 0 ? ((won / total) * 100).toFixed(1) : "0";

  const stageData = STAGES.map(stage => {
    const items = leads?.filter(l => l.status === stage.key) ?? [];
    const pct = total > 0 ? Math.round((items.length / total) * 100) : 0;
    return { ...stage, count: items.length, pct, items };
  });

  const sourceBreakdown: Record<string, number> = {};
  leads?.forEach(l => {
    const src = l.source ?? "unknown";
    sourceBreakdown[src] = (sourceBreakdown[src] ?? 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link href="/reports"><ArrowLeft className="w-4 h-4 mr-1" />Reports</Link></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Pipeline Report</h1>
          <p className="text-muted-foreground text-sm">Lead stages, conversion rates, and performance overview.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: total, color: "text-foreground" },
          { label: "Hot Leads", value: hot, color: "text-red-600" },
          { label: "Won Deals", value: won, color: "text-green-600" },
          { label: "Conversion Rate", value: `${conversionRate}%`, color: "text-blue-600" },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-xl p-5">
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Pipeline by Stage</h2>
        <div className="space-y-3">
          {stageData.map(stage => (
            <div key={stage.key} className="flex items-center gap-3">
              <div className="w-28 text-sm text-right text-muted-foreground shrink-0">{stage.label}</div>
              <div className="flex-1 h-7 bg-muted rounded-md overflow-hidden relative">
                <div className={`h-full ${stage.color} opacity-80 transition-all duration-500`} style={{ width: `${Math.max(stage.pct, stage.count > 0 ? 4 : 0)}%` }} />
              </div>
              <div className="w-16 text-sm font-semibold shrink-0">{stage.count} <span className="text-muted-foreground font-normal">({stage.pct}%)</span></div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">Lead Score Distribution</h2>
          {["hot","warm","cold"].map(score => {
            const count = leads?.filter(l => l.leadScore === score).length ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={score} className="flex items-center justify-between">
                <Badge variant="secondary" className={scoreColors[score]}>{score}</Badge>
                <div className="flex items-center gap-3 flex-1 ml-3">
                  <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${score === "hot" ? "bg-red-500" : score === "warm" ? "bg-amber-500" : "bg-blue-400"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-medium w-16 text-right">{count} ({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">Lead Sources</h2>
          {Object.entries(sourceBreakdown).sort(([,a],[,b]) => b - a).map(([src, count]) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={src} className="flex items-center gap-3">
                <span className="capitalize text-sm w-28 shrink-0 text-muted-foreground">{src.replace("_"," ")}</span>
                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-medium w-12 text-right">{count}</span>
              </div>
            );
          })}
          {Object.keys(sourceBreakdown).length === 0 && <p className="text-sm text-muted-foreground">No data.</p>}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b"><h2 className="font-semibold">Recent Active Leads</h2></div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-3 font-medium">Lead</th>
              <th className="text-left p-3 font-medium">Company</th>
              <th className="text-left p-3 font-medium">Score</th>
              <th className="text-left p-3 font-medium">Stage</th>
              <th className="text-left p-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {leads?.filter(l => !["won","lost"].includes(l.status)).slice(0, 15).map(l => (
              <tr key={l.id} className="border-t hover:bg-muted/20">
                <td className="p-3">
                  <Link href={`/crm/leads/${l.id}`} className="text-primary hover:underline font-medium">{l.leadName}</Link>
                  <div className="text-xs text-muted-foreground font-mono">{l.leadNumber}</div>
                </td>
                <td className="p-3 text-muted-foreground">{l.companyName || "-"}</td>
                <td className="p-3"><Badge variant="secondary" className={scoreColors[l.leadScore ?? ""] ?? ""}>{l.leadScore}</Badge></td>
                <td className="p-3 capitalize text-muted-foreground">{l.status?.replace("_"," ")}</td>
                <td className="p-3 capitalize text-muted-foreground">{l.source?.replace("_"," ") || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
