import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useListDeals, useCreateDeal, useUpdateDeal, useDeleteDeal,
  useListLeads, useListUsers,
} from "@workspace/api-client-react";
import type { Deal, CreateDealBody, Lead, User } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ExecutiveHeader, KPIWidget } from "@/components/crm/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompanyField } from "@/components/CompanyField";
import {
  Handshake, Plus, Search, GripVertical, DollarSign, TrendingUp,
  LayoutList, Kanban, Pencil, Trash2,
} from "lucide-react";

const STAGES = [
  { key: "prospecting",   label: "Prospecting",   accent: "border-slate-400",   badge: "bg-slate-100 text-slate-700" },
  { key: "qualification", label: "Qualification", accent: "border-blue-500",    badge: "bg-blue-100 text-blue-700" },
  { key: "proposal",      label: "Proposal",      accent: "border-purple-500",  badge: "bg-purple-100 text-purple-700" },
  { key: "negotiation",   label: "Negotiation",   accent: "border-orange-500",  badge: "bg-orange-100 text-orange-700" },
  { key: "closed_won",    label: "Closed Won",    accent: "border-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
  { key: "closed_lost",   label: "Closed Lost",   accent: "border-red-500",     badge: "bg-red-100 text-red-700" },
];

interface DealForm {
  title: string;
  clientName: string;
  value: string;
  stage: string;
  probability: string;
  expectedCloseDate: string;
  companyId: string;
  leadId: string;
  notes: string;
  assignedToId: string;
}

const emptyForm: DealForm = {
  title: "", clientName: "", value: "", stage: "prospecting",
  probability: "", expectedCloseDate: "", companyId: "", leadId: "", notes: "", assignedToId: "",
};

function formToBody(form: DealForm): CreateDealBody {
  return {
    title: form.title,
    clientName: form.clientName || undefined,
    value: form.value ? parseFloat(form.value) : undefined,
    stage: form.stage,
    probability: form.probability ? parseFloat(form.probability) : undefined,
    expectedCloseDate: form.expectedCloseDate || undefined,
    companyId: form.companyId ? parseInt(form.companyId, 10) : undefined,
    leadId: form.leadId ? parseInt(form.leadId, 10) : undefined,
    notes: form.notes || undefined,
    assignedToId: form.assignedToId ? parseInt(form.assignedToId, 10) : undefined,
  };
}

export function DealsList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { filterByCompany, activeCompanyId } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const primeBtnCls = isElite ? "bg-[#0D0D0D] hover:bg-[#8B0000]" : "bg-[#0f2d5a] hover:bg-[#1e6ab0]";
  const [view, setView] = useState<"list" | "kanban">("kanban");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DealForm>(emptyForm);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [editForm, setEditForm] = useState<DealForm>(emptyForm);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const { data: dealsRaw, isLoading } = useListDeals({});
  const { data: leadsRaw } = useListLeads({});
  const { data: users } = useListUsers();

  const create = useCreateDeal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/deals"] });
        setOpen(false);
        setForm(emptyForm);
        toast({ title: "Deal created" });
      },
    },
  });

  const update = useUpdateDeal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/deals"] });
        setEditDeal(null);
        toast({ title: "Deal updated" });
      },
    },
  });

  const deleteDeal = useDeleteDeal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/deals"] });
        toast({ title: "Deal deleted" });
      },
    },
  });

  const deals: Deal[] = useMemo(() => {
    let rows = filterByCompany(dealsRaw ?? []) as Deal[];
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(d =>
        d.title.toLowerCase().includes(s) ||
        (d.clientName ?? "").toLowerCase().includes(s) ||
        d.dealNumber.toLowerCase().includes(s),
      );
    }
    if (stageFilter !== "all") rows = rows.filter(d => d.stage === stageFilter);
    return rows;
  }, [dealsRaw, filterByCompany, search, stageFilter]);

  const totalValue = deals.reduce((s, d) => s + (d.value ?? 0), 0);
  const wonValue = deals.filter(d => d.stage === "closed_won").reduce((s, d) => s + (d.value ?? 0), 0);
  const openCount = deals.filter(d => !["closed_won", "closed_lost"].includes(d.stage)).length;

  const dealsByStage = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const s of STAGES) map[s.key] = [];
    for (const d of deals) {
      if (map[d.stage]) map[d.stage].push(d);
      else map["prospecting"].push(d);
    }
    return map;
  }, [deals]);

  const leads: Lead[] = useMemo(() => filterByCompany(leadsRaw ?? []) as Lead[], [leadsRaw, filterByCompany]);
  const userList: User[] = useMemo(() => (users ?? []) as User[], [users]);

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  };

  const handleDrop = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setDragOverStage(null);
    const id = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!Number.isFinite(id)) return;
    const deal = deals.find(d => d.id === id);
    if (!deal || deal.stage === stage) return;
    update.mutate({ id, data: { ...deal, stage } });
    setDraggingId(null);
  };

  const openEdit = (deal: Deal) => {
    setEditDeal(deal);
    setEditForm({
      title: deal.title,
      clientName: deal.clientName ?? "",
      value: deal.value != null ? String(deal.value) : "",
      stage: deal.stage,
      probability: deal.probability != null ? String(deal.probability) : "",
      expectedCloseDate: deal.expectedCloseDate ?? "",
      companyId: deal.companyId != null ? String(deal.companyId) : "",
      leadId: deal.leadId != null ? String(deal.leadId) : "",
      notes: deal.notes ?? "",
      assignedToId: deal.assignedToId != null ? String(deal.assignedToId) : "",
    });
  };

  return (
    <div className="space-y-4">
      <ExecutiveHeader icon={Handshake} title="Deals" subtitle="Track and manage your sales opportunities">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-white text-[#0f2d5a] hover:bg-white/90">
              <Plus className="w-4 h-4 mr-2" />New Deal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>New Deal</DialogTitle></DialogHeader>
            <DealFormFields form={form} setForm={setForm} leads={leads} users={userList} />
            <Button
              className={`mt-2 ${primeBtnCls}`}
              onClick={() => create.mutate({ data: formToBody(form) })}
              disabled={!form.title || create.isPending}
            >{create.isPending ? "Saving…" : "Create Deal"}</Button>
          </DialogContent>
        </Dialog>
      </ExecutiveHeader>

      <div className="grid grid-cols-3 gap-3">
        <KPIWidget icon={Handshake}   tone="blue"  label="Open Deals" value={openCount} sub="In progress" />
        <KPIWidget icon={DollarSign}  tone="green" label="Pipeline"   value={`AED ${totalValue.toLocaleString()}`} sub="Total value" />
        <KPIWidget icon={TrendingUp}  tone="amber" label="Won"        value={`AED ${wonValue.toLocaleString()}`} sub="Closed won" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search deals…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Stages" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 border rounded-md p-0.5">
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="sm" className="h-7 px-2"
            onClick={() => setView("kanban")}
          ><Kanban className="w-4 h-4" /></Button>
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm" className="h-7 px-2"
            onClick={() => setView("list")}
          ><LayoutList className="w-4 h-4" /></Button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {STAGES.map(stage => {
              const stageDeals = dealsByStage[stage.key] ?? [];
              const stageValue = stageDeals.reduce((s, d) => s + (d.value ?? 0), 0);
              const isOver = dragOverStage === stage.key;
              return (
                <div
                  key={stage.key}
                  onDragOver={e => { e.preventDefault(); setDragOverStage(stage.key); }}
                  onDragLeave={() => { if (dragOverStage === stage.key) setDragOverStage(null); }}
                  onDrop={e => handleDrop(e, stage.key)}
                  className={`w-72 shrink-0 bg-muted/30 rounded-xl border-2 border-t-4 ${stage.accent} ${isOver ? "ring-2 ring-[#1e6ab0] bg-[#1e6ab0]/5" : "border-transparent"} transition-all`}
                >
                  <div className="p-3 border-b border-border/50">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">{stage.label}</div>
                      <Badge variant="secondary" className={`${stage.badge} text-[10px]`}>{stageDeals.length}</Badge>
                    </div>
                    <div className="text-[11px] font-medium text-foreground/80 mt-1">AED {stageValue.toLocaleString()}</div>
                  </div>
                  <div className="p-2 space-y-2 min-h-[260px] max-h-[calc(100vh-340px)] overflow-y-auto">
                    {isLoading ? (
                      <div className="text-xs text-muted-foreground text-center py-6">Loading…</div>
                    ) : stageDeals.length === 0 ? (
                      <div className="text-xs text-muted-foreground/60 text-center py-8 italic">Drop deals here</div>
                    ) : stageDeals.map(d => (
                      <div
                        key={d.id}
                        draggable
                        onDragStart={e => handleDragStart(e, d.id)}
                        onDragEnd={() => setDraggingId(null)}
                        className={`bg-card border rounded-xl p-2.5 cursor-grab active:cursor-grabbing hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ${draggingId === d.id ? "opacity-40" : ""}`}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <Link href={`/crm/deals/${d.id}`}>
                              <div className="text-sm font-semibold leading-tight truncate hover:text-primary">{d.title}</div>
                              {d.clientName && <div className="text-[11px] text-muted-foreground truncate">{d.clientName}</div>}
                            </Link>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs font-bold text-emerald-600">AED {(d.value ?? 0).toLocaleString()}</span>
                              {d.probability != null && (
                                <span className="text-[10px] text-muted-foreground">{d.probability}%</span>
                              )}
                            </div>
                            {d.expectedCloseDate && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">Close: {d.expectedCloseDate}</div>
                            )}
                            <div className="flex gap-1 mt-1.5 justify-end">
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEdit(d)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                onClick={() => { if (confirm("Delete this deal?")) deleteDeal.mutate({ id: d.id }); }}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Value (AED)</TableHead>
                <TableHead>Probability</TableHead>
                <TableHead>Close Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading deals…</TableCell></TableRow>
              ) : deals.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No deals found.</TableCell></TableRow>
              ) : deals.map(d => {
                const stage = STAGES.find(s => s.key === d.stage);
                return (
                  <TableRow key={d.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs text-primary">{d.dealNumber}</TableCell>
                    <TableCell>
                      <Link href={`/crm/deals/${d.id}`} className="font-medium hover:underline hover:text-primary">{d.title}</Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.clientName || "—"}</TableCell>
                    <TableCell>
                      {stage && <Badge variant="secondary" className={`${stage.badge} text-xs`}>{stage.label}</Badge>}
                    </TableCell>
                    <TableCell className="font-medium text-emerald-700">{(d.value ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{d.probability != null ? `${d.probability}%` : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.expectedCloseDate || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(d)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm("Delete this deal?")) deleteDeal.mutate({ id: d.id }); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editDeal} onOpenChange={o => !o && setEditDeal(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Edit Deal</DialogTitle></DialogHeader>
          <DealFormFields form={editForm} setForm={setEditForm} leads={leads} users={userList} />
          <Button
            className={`mt-2 ${primeBtnCls}`}
            onClick={() => editDeal && update.mutate({ id: editDeal.id, data: formToBody(editForm) })}
            disabled={!editForm.title || update.isPending}
          >{update.isPending ? "Saving…" : "Save Changes"}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface DealFormFieldsProps {
  form: DealForm;
  setForm: React.Dispatch<React.SetStateAction<DealForm>>;
  leads: Lead[];
  users: User[];
}

function DealFormFields({ form, setForm, leads, users }: DealFormFieldsProps) {
  const field = (k: keyof DealForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));
  return (
    <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1 pt-1">
      <div className="space-y-1 col-span-2">
        <Label>Deal Title *</Label>
        <Input value={form.title} onChange={field("title")} placeholder="e.g. Villa Project – Al Nahyan" />
      </div>
      <div className="space-y-1">
        <Label>Client Name</Label>
        <Input value={form.clientName} onChange={field("clientName")} placeholder="Client / company" />
      </div>
      <div className="space-y-1">
        <Label>Value (AED)</Label>
        <Input type="number" value={form.value} onChange={field("value")} placeholder="0" />
      </div>
      <div className="space-y-1">
        <Label>Stage</Label>
        <Select value={form.stage} onValueChange={v => setForm(p => ({ ...p, stage: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Probability (%)</Label>
        <Input type="number" min="0" max="100" value={form.probability} onChange={field("probability")} placeholder="50" />
      </div>
      <div className="space-y-1">
        <Label>Expected Close Date</Label>
        <Input type="date" value={form.expectedCloseDate} onChange={field("expectedCloseDate")} />
      </div>
      <div className="space-y-1">
        <Label>Assigned To</Label>
        <Select value={form.assignedToId || "none"} onValueChange={v => setForm(p => ({ ...p, assignedToId: v === "none" ? "" : v }))}>
          <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unassigned</SelectItem>
            {users.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1 col-span-2">
        <Label>Brand / Company</Label>
        <CompanyField value={form.companyId} onChange={v => setForm(p => ({ ...p, companyId: v }))} />
      </div>
      <div className="space-y-1 col-span-2">
        <Label>Linked Lead</Label>
        <Select value={form.leadId || "none"} onValueChange={v => setForm(p => ({ ...p, leadId: v === "none" ? "" : v }))}>
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {leads.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.leadName}{l.leadNumber ? ` (${l.leadNumber})` : ""}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1 col-span-2">
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={field("notes")} rows={3} />
      </div>
    </div>
  );
}
