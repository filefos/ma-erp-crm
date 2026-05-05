import type { ReactElement } from "react";
import { useState, useEffect } from "react";
import { useGetProject, useUpdateProject, useListUsers } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, Clock, Circle, Pencil, Save, X, Calendar, MapPin, User, Truck, Briefcase } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { getGetProjectQueryKey } from "@workspace/api-client-react";
import { authHeaders } from "@/lib/ai-client";

interface Props { id: string }

const pipelineStatuses = ["pending", "in_progress", "done"];

function StatusBadge({ status }: { status: string | null }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    in_progress: "bg-blue-100 text-blue-800",
    done: "bg-green-100 text-green-800",
    paid: "bg-green-100 text-green-800",
    partial: "bg-orange-100 text-orange-800",
    unpaid: "bg-red-100 text-red-800",
  };
  const icons: Record<string, ReactElement> = {
    done: <CheckCircle2 className="w-3 h-3" />,
    paid: <CheckCircle2 className="w-3 h-3" />,
    in_progress: <Clock className="w-3 h-3" />,
    pending: <Circle className="w-3 h-3" />,
    unpaid: <Circle className="w-3 h-3" />,
  };
  return <Badge variant="secondary" className={`${colors[status ?? "pending"] ?? ""} flex items-center gap-1`}>{icons[status ?? "pending"]}{status?.replace("_", " ")}</Badge>;
}

export function ProjectDetail({ id }: Props) {
  const pid = parseInt(id, 10);
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useGetProject(pid, { query: { queryKey: getGetProjectQueryKey(pid), enabled: !!pid } });
  const { data: users } = useListUsers();
  const update = useUpdateProject({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(pid) }) } });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>({});

  useEffect(() => {
    if (project && !editing) {
      setDraft({
        salespersonId: (project as any).salespersonId ?? null,
        startDate: project.startDate ?? "",
        endDate: project.endDate ?? "",
        deliveryDate: (project as any).deliveryDate ?? "",
        location: project.location ?? "",
        projectValue: project.projectValue ?? 0,
        clientName: project.clientName ?? "",
      });
    }
  }, [project, editing]);

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!project) return <div className="text-muted-foreground p-8">Project not found.</div>;

  const updateField = (field: string, value: string) => update.mutate({ id: pid, data: { [field]: value } as any });

  const saveDraft = () => {
    update.mutate({
      id: pid,
      data: {
        salespersonId: draft.salespersonId ? Number(draft.salespersonId) : undefined,
        startDate: draft.startDate || undefined,
        endDate: draft.endDate || undefined,
        deliveryDate: draft.deliveryDate || undefined,
        location: draft.location || undefined,
        projectValue: draft.projectValue ? Number(draft.projectValue) : undefined,
        clientName: draft.clientName || undefined,
      } as any,
    });
    setEditing(false);
  };

  const salesUsers = (users ?? []).filter((u: any) => {
    const r = (u.role ?? "").toLowerCase();
    return r === "sales" || r.includes("sales") || r === "main_admin" || r === "admin" || r === "manager";
  });

  const pipeline = [
    { label: "Procurement", field: "procurementStatus", value: project.procurementStatus },
    { label: "Production", field: "productionStatus", value: project.productionStatus },
    { label: "Delivery", field: "deliveryStatus", value: project.deliveryStatus },
    { label: "Installation", field: "installationStatus", value: project.installationStatus },
    { label: "Payment", field: "paymentStatus", value: project.paymentStatus },
  ];

  const salespersonName = (project as any).salespersonName as string | undefined;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" asChild><Link href="/projects"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{project.projectName}</h1>
          <p className="text-muted-foreground">{project.projectNumber} · {project.clientName}</p>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="w-4 h-4 mr-1" />Cancel</Button>
            <Button size="sm" onClick={saveDraft} className="bg-[#0f2d5a] hover:bg-[#163d76]"><Save className="w-4 h-4 mr-1" />Save</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="w-4 h-4 mr-1" />Edit Details</Button>
        )}
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase className="w-3 h-3" />Project Value</div><div className="text-lg font-bold text-[#1e6ab0]">AED {Number(project.projectValue ?? 0).toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />Location</div><div className="text-sm font-medium">{project.location || "-"}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" />Salesperson</div><div className="text-sm font-medium">{salespersonName || <span className="italic text-muted-foreground">Unassigned</span>}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Truck className="w-3 h-3" />Delivery Date</div><div className="text-sm font-medium">{(project as any).deliveryDate || "-"}</div></CardContent></Card>
      </div>

      {/* Timeline & details */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" />Project Timeline & Assignment</CardTitle></CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Salesperson">
                <Select value={draft.salespersonId ? String(draft.salespersonId) : ""} onValueChange={(v) => setDraft({ ...draft, salespersonId: v ? parseInt(v, 10) : null })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select salesperson..." /></SelectTrigger>
                  <SelectContent>
                    {salesUsers.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Client Name"><Input value={draft.clientName} onChange={e => setDraft({ ...draft, clientName: e.target.value })} className="h-9" /></Field>
              <Field label="Location"><Input value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} className="h-9" /></Field>
              <Field label="Project Value (AED)"><Input type="number" value={draft.projectValue} onChange={e => setDraft({ ...draft, projectValue: e.target.value })} className="h-9" /></Field>
              <Field label="Start Date"><Input type="date" value={draft.startDate} onChange={e => setDraft({ ...draft, startDate: e.target.value })} className="h-9" /></Field>
              <Field label="Finish Date"><Input type="date" value={draft.endDate} onChange={e => setDraft({ ...draft, endDate: e.target.value })} className="h-9" /></Field>
              <Field label="Delivery Date"><Input type="date" value={draft.deliveryDate} onChange={e => setDraft({ ...draft, deliveryDate: e.target.value })} className="h-9" /></Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <Item label="Project No." value={project.projectNumber} />
              <Item label="Client" value={project.clientName} />
              <Item label="Salesperson" value={salespersonName ?? "Unassigned"} />
              <Item label="Location" value={project.location ?? "-"} />
              <Item label="Project Value" value={`AED ${Number(project.projectValue ?? 0).toLocaleString()}`} />
              <Item label="Stage" value={<Badge variant="secondary" className="capitalize">{project.stage.replace("_"," ")}</Badge>} />
              <Item label="Start Date"   value={project.startDate ?? "-"} />
              <Item label="Finish Date"  value={project.endDate ?? "-"} />
              <Item label="Delivery Date" value={(project as any).deliveryDate ?? "-"} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Project Pipeline Status</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {pipeline.map(stage => (
              <div key={stage.field} className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-2">{stage.label} <StatusBadge status={stage.value ?? "pending"} /></div>
                <Select value={stage.value ?? "pending"} onValueChange={v => updateField(stage.field, v)}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stage.field === "paymentStatus"
                      ? ["unpaid", "partial", "paid"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)
                      : pipelineStatuses.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ProjectProfitability projectId={pid} />

      {project.scope && (
        <Card>
          <CardHeader><CardTitle className="text-base">Scope of Work</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-line">{project.scope}</p></CardContent>
        </Card>
      )}
    </div>
  );
}

function ProjectProfitability({ projectId }: { projectId: number }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    fetch(`${import.meta.env.BASE_URL}api/projects/${projectId}/cost-summary`, { headers: authHeaders(), credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(j => on && setData(j))
      .catch(e => on && setErr(String(e)));
    return () => { on = false; };
  }, [projectId]);

  if (err) return null;
  if (!data) return (
    <Card><CardHeader><CardTitle className="text-base">Project Profitability</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">Loading…</CardContent>
    </Card>
  );

  const fmt = (n: number) => `AED ${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const profitColor = data.profit >= 0 ? "text-green-700" : "text-red-700";

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Project Profitability</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Tile label="Quoted Value" value={fmt(data.projectValue)} />
          <Tile label="Invoiced (Revenue)" value={fmt(data.revenue)} sub={`${fmt(data.collected)} collected`} />
          <Tile label="Procurement Cost" value={fmt(data.procurementCost)} sub={`${data.purchaseOrders.length} PO(s)`} />
          <Tile label="Other Expenses" value={fmt(data.expensesCost)} sub={`${data.expenses.length} item(s)`} />
          <Tile label="Profit" value={<span className={profitColor}>{fmt(data.profit)}</span>} sub={`${data.margin.toFixed(1)}% margin`} />
        </div>
        {data.invoices.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Linked Tax Invoices</div>
            <div className="flex flex-wrap gap-2">
              {data.invoices.map((i: any) => (
                <Link key={i.id} href={`/accounts/invoices/${i.id}`}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-slate-100">
                    {i.invoiceNumber} · {fmt(i.grandTotal)} · {i.paymentStatus}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
        {data.purchaseOrders.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Linked Purchase Orders</div>
            <div className="flex flex-wrap gap-2">
              {data.purchaseOrders.map((p: any) => (
                <Badge key={p.id} variant="outline">{p.poNumber} · {fmt(p.total)} · {p.status}</Badge>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Costs are linked via Purchase Requests on this project. Expenses match by project number in the invoice-number field. Numbers are read-only and update as documents change.
        </p>
      </CardContent>
    </Card>
  );
}

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-md border p-3 bg-slate-50">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
