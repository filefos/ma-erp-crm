import { useState } from "react";
import { useListProjects } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Search, Target } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const stageColors: Record<string, string> = {
  new_project:  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  production:   "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  procurement:  "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  delivery:     "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  installation: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  testing:      "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  handover:     "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  completed:    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

function getProgress(project: any) {
  const statuses = [project.procurementStatus, project.productionStatus, project.deliveryStatus, project.installationStatus, project.paymentStatus];
  const done = statuses.filter(s => s === "done" || s === "paid").length;
  return Math.round((done / statuses.length) * 100);
}

export function ProjectsList() {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const { data: projects, isLoading } = useListProjects({ stage: stage === "all" ? undefined : stage, search: search || undefined });
  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(projects ?? []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Track all active and completed prefab projects.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/projects/sales-performance"><Target className="w-4 h-4 mr-1.5" />Sales Performance</Link>
          </Button>
          <ExportMenu
            data={filtered as Record<string, unknown>[]}
            columns={[
              { header: "Project No.", key: "projectNumber" },
              { header: "Project Name", key: "projectName" },
              { header: "Client", key: "clientName" },
              { header: "Location", key: "location" },
              { header: "Salesperson", key: "salespersonName" },
              { header: "Stage", key: "stage" },
              { header: "Value (AED)", key: "projectValue", format: v => Number(v ?? 0).toFixed(2) },
              { header: "Start Date", key: "startDate" },
              { header: "End Date", key: "endDate" },
              { header: "Delivery Date", key: "deliveryDate" },
            ]}
            filename="projects"
            title="Projects"
          />
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {Object.keys(stageColors).map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project No.</TableHead>
              <TableHead>Project Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Salesperson</TableHead>
              <TableHead className="text-right">Value (AED)</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Finish</TableHead>
              <TableHead>Delivery</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered.length === 0 ? <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No projects found.</TableCell></TableRow> :
            filtered.map(p => {
              const progress = getProgress(p);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link href={`/projects/${p.id}`} className="text-primary hover:underline">{p.projectNumber}</Link>
                  </TableCell>
                  <TableCell className="font-medium">{p.projectName}</TableCell>
                  <TableCell>{p.clientName}</TableCell>
                  <TableCell className="text-muted-foreground">{p.location || "-"}</TableCell>
                  <TableCell>{(p as any).salespersonName || <span className="text-muted-foreground italic text-xs">Unassigned</span>}</TableCell>
                  <TableCell className="text-right font-semibold">AED {Number(p.projectValue ?? 0).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary" className={stageColors[p.stage] ?? ""}>{p.stage.replace("_"," ")}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <Progress value={progress} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-8">{progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{p.startDate || "-"}</TableCell>
                  <TableCell className="text-xs">{p.endDate || "-"}</TableCell>
                  <TableCell className="text-xs">{(p as any).deliveryDate || "-"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
