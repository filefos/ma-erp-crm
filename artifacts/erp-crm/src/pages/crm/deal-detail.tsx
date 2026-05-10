import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useListDeals, useUpdateDeal, useDeleteDeal,
  useListActivities, useCreateActivity, useUpdateActivity, useDeleteActivity,
  useListLeads,
} from "@workspace/api-client-react";
import type { Deal, Activity, CreateActivityBody, Lead } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Pencil, Trash2, Plus, Phone, Mail, MessageCircle,
  Calendar, CheckCircle2, Clock, DollarSign, Handshake, Activity as ActivityIcon,
} from "lucide-react";

const STAGES = [
  { key: "prospecting",   label: "Prospecting",   cls: "bg-slate-100 text-slate-700" },
  { key: "qualification", label: "Qualification", cls: "bg-blue-100 text-blue-700" },
  { key: "proposal",      label: "Proposal",      cls: "bg-purple-100 text-purple-700" },
  { key: "negotiation",   label: "Negotiation",   cls: "bg-orange-100 text-orange-700" },
  { key: "closed_won",    label: "Closed Won",    cls: "bg-emerald-100 text-emerald-700" },
  { key: "closed_lost",   label: "Closed Lost",   cls: "bg-red-100 text-red-700" },
];


const ACTIVITY_TYPES = ["call", "email", "meeting", "task", "note", "site_visit", "demo", "follow_up"];

interface ActivityForm {
  type: string;
  subject: string;
  description: string;
  dueDate: string;
  isDone: boolean;
}

interface EditDealForm {
  title: string;
  clientName: string;
  value: string;
  stage: string;
  probability: string;
  expectedCloseDate: string;
  notes: string;
}

const emptyActivityForm: ActivityForm = {
  type: "call", subject: "", description: "", dueDate: "", isDone: false,
};

interface Props { id: string }

export function DealDetail({ id }: Props) {
  const did = parseInt(id, 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { filterByCompany, activeCompanyId } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const primeBtnCls = isElite ? "bg-[#0D0D0D] hover:bg-[#8B0000]" : "bg-[#0f2d5a] hover:bg-[#1e6ab0]";

  const { data: dealsRaw, isLoading } = useListDeals({});
  const { data: activitiesRaw } = useListActivities({ dealId: did });
  const { data: leadsRaw } = useListLeads({});

  const deal: Deal | undefined = (filterByCompany(dealsRaw ?? []) as Deal[]).find(d => d.id === did);
  const activities: Activity[] = (filterByCompany(activitiesRaw ?? []) as Activity[]);
  const linkedLead: Lead | undefined = deal?.leadId
    ? (leadsRaw as Lead[] | undefined)?.find(l => l.id === deal.leadId)
    : undefined;

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditDealForm>({
    title: "", clientName: "", value: "", stage: "prospecting", probability: "", expectedCloseDate: "", notes: "",
  });

  const [activityOpen, setActivityOpen] = useState(false);
  const [activityForm, setActivityForm] = useState<ActivityForm>(emptyActivityForm);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [editActivityForm, setEditActivityForm] = useState<ActivityForm>(emptyActivityForm);

  const update = useUpdateDeal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/deals"] });
        setEditOpen(false);
        toast({ title: "Deal updated" });
      },
    },
  });

  const deleteDeal = useDeleteDeal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/deals"] });
        navigate("/crm/deals");
        toast({ title: "Deal deleted" });
      },
    },
  });

  const createActivity = useCreateActivity({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/activities"] });
        setActivityOpen(false);
        setActivityForm(emptyActivityForm);
        toast({ title: "Activity logged" });
      },
    },
  });

  const updateActivity = useUpdateActivity({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/activities"] });
        setEditActivity(null);
        toast({ title: "Activity updated" });
      },
    },
  });

  const deleteActivity = useDeleteActivity({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/activities"] });
        toast({ title: "Activity removed" });
      },
    },
  });

  const openEditDeal = () => {
    if (!deal) return;
    setEditForm({
      title: deal.title,
      clientName: deal.clientName ?? "",
      value: deal.value != null ? String(deal.value) : "",
      stage: deal.stage,
      probability: deal.probability != null ? String(deal.probability) : "",
      expectedCloseDate: deal.expectedCloseDate ?? "",
      notes: deal.notes ?? "",
    });
    setEditOpen(true);
  };

  const submitEdit = () => {
    if (!deal) return;
    update.mutate({
      id: deal.id,
      data: {
        title: editForm.title,
        clientName: editForm.clientName || undefined,
        value: editForm.value ? parseFloat(editForm.value) : undefined,
        stage: editForm.stage,
        probability: editForm.probability ? parseFloat(editForm.probability) : undefined,
        expectedCloseDate: editForm.expectedCloseDate || undefined,
        notes: editForm.notes || undefined,
        companyId: deal.companyId,
        leadId: deal.leadId,
        assignedToId: deal.assignedToId,
      },
    });
  };

  const buildActivityBody = (form: ActivityForm, extraDealId?: number): CreateActivityBody => ({
    type: form.type,
    subject: form.subject,
    description: form.description || undefined,
    dueDate: form.dueDate || undefined,
    dealId: extraDealId ?? did,
    isDone: form.isDone,
  });

  const submitActivity = () => {
    createActivity.mutate({ data: buildActivityBody(activityForm) });
  };

  const submitEditActivity = () => {
    if (!editActivity) return;
    updateActivity.mutate({
      id: editActivity.id,
      data: {
        ...buildActivityBody(editActivityForm),
        leadId: editActivity.leadId,
        contactId: editActivity.contactId,
      },
    });
  };

  const markDone = (act: Activity) => {
    updateActivity.mutate({
      id: act.id,
      data: { type: act.type, subject: act.subject, isDone: true, dealId: act.dealId, leadId: act.leadId, contactId: act.contactId },
    });
  };

  const openEditActivity = (act: Activity) => {
    setEditActivity(act);
    setEditActivityForm({
      type: act.type,
      subject: act.subject,
      description: act.description ?? "",
      dueDate: act.dueDate ?? "",
      isDone: act.isDone,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground">Loading deal…</div>;
  }

  if (!deal) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <p className="text-muted-foreground">Deal not found.</p>
        <Button variant="outline" asChild><Link href="/crm/deals"><ArrowLeft className="w-4 h-4 mr-2" />Back to Deals</Link></Button>
      </div>
    );
  }

  const stage = STAGES.find(s => s.key === deal.stage);
  const pending = activities.filter(a => !a.isDone);
  const done = activities.filter(a => a.isDone);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" asChild>
          <Link href="/crm/deals"><ArrowLeft className="w-4 h-4 mr-1.5" />Deals</Link>
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={openEditDeal}><Pencil className="w-4 h-4 mr-1.5" />Edit</Button>
        <Button variant="destructive" size="sm"
          onClick={() => { if (confirm("Delete this deal?")) deleteDeal.mutate({ id: deal.id }); }}>
          <Trash2 className="w-4 h-4 mr-1.5" />Delete
        </Button>
      </div>

      <div className="bg-card border rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Handshake className="w-5 h-5 text-[#1e6ab0]" />
              <span className="text-xs font-mono text-muted-foreground">{deal.dealNumber}</span>
            </div>
            <h1 className="text-2xl font-bold">{deal.title}</h1>
            {deal.clientName && <p className="text-muted-foreground">{deal.clientName}</p>}
          </div>
          {stage && <Badge className={`${stage.cls} text-sm px-3 py-1`}>{stage.label}</Badge>}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat icon={DollarSign}    label="Value"          value={`AED ${(deal.value ?? 0).toLocaleString()}`} />
          <Stat icon={CheckCircle2}  label="Probability"    value={deal.probability != null ? `${deal.probability}%` : "—"} />
          <Stat icon={Calendar}      label="Expected Close" value={deal.expectedCloseDate || "—"} />
          <Stat icon={Clock}         label="Created"        value={deal.createdAt.slice(0, 10)} />
        </div>

        {deal.notes && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
              <p className="text-sm whitespace-pre-line">{deal.notes}</p>
            </div>
          </>
        )}

        {linkedLead && (
          <>
            <Separator />
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linked Lead:</span>
              <Link href={`/crm/leads/${linkedLead.id}`} className="text-sm text-primary hover:underline">
                {linkedLead.leadName} ({linkedLead.leadNumber})
              </Link>
            </div>
          </>
        )}
      </div>

      <div className="bg-card border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ActivityIcon className="w-5 h-5 text-[#1e6ab0]" />
            <h2 className="font-semibold text-lg">Activities</h2>
            <Badge variant="secondary">{activities.length}</Badge>
          </div>
          <Button size="sm" className={primeBtnCls} onClick={() => setActivityOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />Log Activity
          </Button>
        </div>

        {activities.length === 0 ? (
          <div className="text-sm text-muted-foreground italic text-center py-8">
            No activities yet. Log your first interaction above.
          </div>
        ) : (
          <div className="space-y-4">
            {pending.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pending ({pending.length})</p>
                <ActivityList activities={pending} onMarkDone={markDone} onEdit={openEditActivity}
                  onDelete={a => { if (confirm("Remove activity?")) deleteActivity.mutate({ id: a.id }); }} />
              </div>
            )}
            {done.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Completed ({done.length})</p>
                <ActivityList activities={done} onMarkDone={markDone} onEdit={openEditActivity}
                  onDelete={a => { if (confirm("Remove activity?")) deleteActivity.mutate({ id: a.id }); }} />
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={o => !o && setEditOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Deal</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="col-span-2 space-y-1"><Label>Title *</Label>
              <Input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-1"><Label>Client</Label>
              <Input value={editForm.clientName} onChange={e => setEditForm(p => ({ ...p, clientName: e.target.value }))} />
            </div>
            <div className="space-y-1"><Label>Value (AED)</Label>
              <Input type="number" value={editForm.value} onChange={e => setEditForm(p => ({ ...p, value: e.target.value }))} />
            </div>
            <div className="space-y-1"><Label>Stage</Label>
              <Select value={editForm.stage} onValueChange={v => setEditForm(p => ({ ...p, stage: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Probability (%)</Label>
              <Input type="number" min="0" max="100" value={editForm.probability} onChange={e => setEditForm(p => ({ ...p, probability: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1"><Label>Expected Close Date</Label>
              <Input type="date" value={editForm.expectedCloseDate} onChange={e => setEditForm(p => ({ ...p, expectedCloseDate: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1"><Label>Notes</Label>
              <Textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <Button className={`mt-2 ${primeBtnCls}`} onClick={submitEdit} disabled={!editForm.title || update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={activityOpen} onOpenChange={o => !o && setActivityOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
          <ActivityFormFields form={activityForm} setForm={setActivityForm} />
          <Button className={`mt-2 ${primeBtnCls}`} onClick={submitActivity} disabled={!activityForm.subject || createActivity.isPending}>
            {createActivity.isPending ? "Saving…" : "Log Activity"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editActivity} onOpenChange={o => !o && setEditActivity(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Activity</DialogTitle></DialogHeader>
          <ActivityFormFields form={editActivityForm} setForm={setEditActivityForm} />
          <Button className={`mt-2 ${primeBtnCls}`} onClick={submitEditActivity} disabled={!editActivityForm.subject || updateActivity.isPending}>
            {updateActivity.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />{label}
      </div>
      <div className="font-semibold text-sm">{value}</div>
    </div>
  );
}

function ActivityList({ activities, onMarkDone, onEdit, onDelete }: {
  activities: Activity[];
  onMarkDone: (a: Activity) => void;
  onEdit: (a: Activity) => void;
  onDelete: (a: Activity) => void;
}) {
  return (
    <div className="bg-muted/20 rounded-xl divide-y border">
      {activities.map(a => (
        <div key={a.id} className={`p-3 flex items-start gap-3 ${a.isDone ? "opacity-60" : ""}`}>
          <div className="w-8 h-8 rounded-lg bg-[#1e6ab0]/10 flex items-center justify-center shrink-0 mt-0.5">
            {a.type === "call"    ? <Phone className="w-4 h-4 text-[#1e6ab0]" />
            : a.type === "email"  ? <Mail className="w-4 h-4 text-[#1e6ab0]" />
            : a.type === "meeting"? <MessageCircle className="w-4 h-4 text-[#1e6ab0]" />
            : <ActivityIcon className="w-4 h-4 text-[#1e6ab0]" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium text-sm ${a.isDone ? "line-through" : ""}`}>{a.subject}</span>
              <Badge variant="outline" className="capitalize text-[10px]">{a.type.replace("_", " ")}</Badge>
              {a.isDone && <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px]">Done</Badge>}
            </div>
            {a.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.description}</p>}
            {a.dueDate && <p className="text-[11px] text-muted-foreground mt-0.5">Due: {a.dueDate}</p>}
          </div>
          <div className="flex gap-1 shrink-0">
            {!a.isDone && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => onMarkDone(a)}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Done
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(a)}>
              <Pencil className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => onDelete(a)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityFormFields({ form, setForm }: {
  form: ActivityForm;
  setForm: React.Dispatch<React.SetStateAction<ActivityForm>>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 pt-1">
      <div className="space-y-1">
        <Label>Type</Label>
        <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ACTIVITY_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Due Date</Label>
        <Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
      </div>
      <div className="col-span-2 space-y-1">
        <Label>Subject *</Label>
        <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. Follow-up call with client" />
      </div>
      <div className="col-span-2 space-y-1">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} />
      </div>
    </div>
  );
}
