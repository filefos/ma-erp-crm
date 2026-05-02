import type { ReactElement } from "react";
import { useGetProject, useUpdateProject } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, Clock, Circle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { getGetProjectQueryKey } from "@workspace/api-client-react";

interface Props { id: string }

const pipelineStatuses = ["pending","in_progress","done"];

function StatusBadge({ status }: { status: string | null }) {
  const colors: Record<string, string> = { pending: "bg-gray-100 text-gray-700", in_progress: "bg-blue-100 text-blue-800", done: "bg-green-100 text-green-800", paid: "bg-green-100 text-green-800", partial: "bg-amber-100 text-amber-800", unpaid: "bg-red-100 text-red-800" };
  const icons: Record<string, ReactElement> = { done: <CheckCircle2 className="w-3 h-3" />, paid: <CheckCircle2 className="w-3 h-3" />, in_progress: <Clock className="w-3 h-3" />, pending: <Circle className="w-3 h-3" />, unpaid: <Circle className="w-3 h-3" /> };
  return <Badge variant="secondary" className={`${colors[status ?? "pending"] ?? ""} flex items-center gap-1`}>{icons[status ?? "pending"]}{status?.replace("_"," ")}</Badge>;
}

export function ProjectDetail({ id }: Props) {
  const pid = parseInt(id, 10);
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useGetProject(pid, { query: { queryKey: getGetProjectQueryKey(pid), enabled: !!pid } });
  const update = useUpdateProject({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(pid) }) } });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!project) return <div className="text-muted-foreground p-8">Project not found.</div>;

  const updateField = (field: string, value: string) => update.mutate({ id: pid, data: { [field]: value } as any });

  const pipeline = [
    { label: "Procurement", field: "procurementStatus", value: project.procurementStatus },
    { label: "Production", field: "productionStatus", value: project.productionStatus },
    { label: "Delivery", field: "deliveryStatus", value: project.deliveryStatus },
    { label: "Installation", field: "installationStatus", value: project.installationStatus },
    { label: "Payment", field: "paymentStatus", value: project.paymentStatus },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild><Link href="/projects"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link></Button>
        <div>
          <h1 className="text-2xl font-bold">{project.projectName}</h1>
          <p className="text-muted-foreground">{project.projectNumber} · {project.clientName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Project Value</div><div className="text-lg font-bold text-primary">AED {project.projectValue?.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Location</div><div className="text-sm font-medium">{project.location || "-"}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Start Date</div><div className="text-sm font-medium">{project.startDate || "-"}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">End Date</div><div className="text-sm font-medium">{project.endDate || "-"}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Project Pipeline Status</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {pipeline.map(stage => (
              <div key={stage.field} className="space-y-2">
                <div className="text-sm font-medium">{stage.label}</div>
                <Select value={stage.value ?? "pending"} onValueChange={v => updateField(stage.field, v)}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stage.field === "paymentStatus"
                      ? ["unpaid","partial","paid"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)
                      : pipelineStatuses.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {project.scope && (
        <Card>
          <CardHeader><CardTitle>Scope of Work</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{project.scope}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
