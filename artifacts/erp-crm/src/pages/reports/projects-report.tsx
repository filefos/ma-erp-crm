import { useListProjects } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Briefcase } from "lucide-react";

const stageColors: Record<string, string> = {
  enquiry: "bg-blue-100 text-blue-800",
  design: "bg-purple-100 text-purple-800",
  approval: "bg-orange-100 text-orange-800",
  production: "bg-orange-100 text-orange-800",
  delivery: "bg-teal-100 text-teal-800",
  installation: "bg-indigo-100 text-indigo-800",
  handover: "bg-green-100 text-green-800",
  completed: "bg-emerald-100 text-emerald-800",
  on_hold: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-800",
};

const STAGE_ORDER = ["enquiry","design","approval","production","delivery","installation","handover","completed","on_hold","cancelled"];

export function ProjectsReport() {
  const { data: projects, isLoading } = useListProjects();

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading report...</div>;

  const ps = (projects ?? []) as any[];
  const total = ps.length;
  const active = ps.filter(p => !["completed","cancelled","on_hold"].includes(p.stage)).length;
  const completed = ps.filter(p => p.stage === "completed").length;
  const totalValue = ps.reduce((s: number, p: any) => s + (p.contractValue ?? 0), 0);

  const byStage: Record<string, any[]> = {};
  STAGE_ORDER.forEach(stage => { byStage[stage] = []; });
  ps.forEach(p => {
    if (!byStage[p.stage]) byStage[p.stage] = [];
    byStage[p.stage].push(p);
  });

  const byCompany: Record<string, { count: number; value: number }> = {};
  ps.forEach((p: any) => {
    const key = p.companyName ?? "Unknown";
    if (!byCompany[key]) byCompany[key] = { count: 0, value: 0 };
    byCompany[key].count += 1;
    byCompany[key].value += p.contractValue ?? 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link href="/reports"><ArrowLeft className="w-4 h-4 mr-1" />Reports</Link></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project Status Report</h1>
          <p className="text-muted-foreground text-sm">Project pipeline, stages, and delivery tracking.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Projects", value: total, color: "text-foreground" },
          { label: "Active", value: active, color: "text-blue-600" },
          { label: "Completed", value: completed, color: "text-green-600" },
          { label: "Total Contract Value", value: `AED ${(totalValue/1000).toFixed(0)}K`, color: "text-orange-600" },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-xl p-5">
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Briefcase className="w-4 h-4 text-primary" />Projects by Stage</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {STAGE_ORDER.filter(s => (byStage[s]?.length ?? 0) > 0).map(stage => (
            <div key={stage} className="border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{byStage[stage]?.length ?? 0}</div>
              <Badge variant="secondary" className={`${stageColors[stage] ?? ""} mt-1 capitalize text-[10px]`}>{stage.replace("_"," ")}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">By Company</h2>
          {Object.entries(byCompany).map(([company, data]) => (
            <div key={company} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm font-medium">{company}</span>
              <div className="text-right">
                <div className="font-semibold">{data.count} projects</div>
                <div className="text-xs text-muted-foreground">AED {data.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
            </div>
          ))}
          {Object.keys(byCompany).length === 0 && <p className="text-sm text-muted-foreground">No data.</p>}
        </div>

        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">Active Projects (Top 10)</h2>
          {projects?.filter(p => !["completed","cancelled"].includes(p.stage)).slice(0, 10).map(p => (
            <div key={p.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
              <div>
                <Link href={`/projects/${p.id}`} className="text-sm font-medium hover:text-primary hover:underline">{p.projectName}</Link>
                <div className="text-xs text-muted-foreground">{(p as any).clientName}</div>
              </div>
              <Badge variant="secondary" className={`${stageColors[p.stage] ?? ""} capitalize text-xs`}>{p.stage.replace("_"," ")}</Badge>
            </div>
          )) ?? <p className="text-sm text-muted-foreground">No active projects.</p>}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b"><h2 className="font-semibold">All Projects</h2></div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-3 font-medium">Project</th>
              <th className="text-left p-3 font-medium">Client</th>
              <th className="text-left p-3 font-medium">Location</th>
              <th className="text-right p-3 font-medium">Contract Value</th>
              <th className="text-left p-3 font-medium">Stage</th>
              <th className="text-left p-3 font-medium">Start Date</th>
            </tr>
          </thead>
          <tbody>
            {projects?.map(p => (
              <tr key={p.id} className="border-t hover:bg-muted/20">
                <td className="p-3">
                  <Link href={`/projects/${p.id}`} className="font-medium hover:text-primary hover:underline">{p.projectName}</Link>
                  <div className="text-xs text-muted-foreground font-mono">{p.projectNumber}</div>
                </td>
                <td className="p-3 text-muted-foreground">{(p as any).clientName || "-"}</td>
                <td className="p-3 text-muted-foreground">{p.location || "-"}</td>
                <td className="p-3 text-right font-medium">AED {((p as any).contractValue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="p-3"><Badge variant="secondary" className={`${stageColors[p.stage] ?? ""} capitalize`}>{p.stage.replace("_"," ")}</Badge></td>
                <td className="p-3 text-muted-foreground">{p.startDate || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
