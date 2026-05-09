import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useListActivities, useCreateActivity, useUpdateActivity, useDeleteActivity,
  useListLeads, useListDeals, useListContacts,
} from "@workspace/api-client-react";
import type { Activity, CreateActivityBody, Lead, Deal, Contact } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ExecutiveHeader, KPIWidget } from "@/components/crm/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity as ActivityIcon, Plus, Search, Phone, Mail, MessageCircle, CheckCircle2,
  Clock, AlertTriangle, Filter, Pencil, Trash2, Calendar,
} from "lucide-react";

const ACTIVITY_TYPES = ["call", "email", "meeting", "task", "note", "site_visit", "demo", "follow_up"];

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  email: Mail,
  meeting: MessageCircle,
  task: CheckCircle2,
  follow_up: Calendar,
};

interface ActivityForm {
  type: string;
  subject: string;
  description: string;
  dueDate: string;
  leadId: string;
  dealId: string;
  contactId: string;
  isDone: boolean;
}

const emptyForm: ActivityForm = {
  type: "call", subject: "", description: "", dueDate: "",
  leadId: "", dealId: "", contactId: "", isDone: false,
};

function formToBody(form: ActivityForm): CreateActivityBody {
  return {
    type: form.type,
    subject: form.subject,
    description: form.description || undefined,
    dueDate: form.dueDate || undefined,
    leadId: form.leadId ? parseInt(form.leadId, 10) : undefined,
    dealId: form.dealId ? parseInt(form.dealId, 10) : undefined,
    contactId: form.contactId ? parseInt(form.contactId, 10) : undefined,
    isDone: form.isDone,
  };
}

function activityToForm(a: Activity): ActivityForm {
  return {
    type: a.type,
    subject: a.subject,
    description: a.description ?? "",
    dueDate: a.dueDate ?? "",
    leadId: a.leadId != null ? String(a.leadId) : "",
    dealId: a.dealId != null ? String(a.dealId) : "",
    contactId: a.contactId != null ? String(a.contactId) : "",
    isDone: a.isDone,
  };
}

export function ActivitiesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { filterByCompany } = useActiveCompany();

  const [typeFilter, setTypeFilter] = useState("all");
  const [leadFilter, setLeadFilter] = useState("all");
  const [dealFilter, setDealFilter] = useState("all");
  const [contactFilter, setContactFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ActivityForm>(emptyForm);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [editForm, setEditForm] = useState<ActivityForm>(emptyForm);

  const { data: activitiesRaw, isLoading } = useListActivities({});
  const { data: leadsRaw } = useListLeads({});
  const { data: dealsRaw } = useListDeals({});
  const { data: contactsRaw } = useListContacts({});

  const leads: Lead[] = useMemo(() => filterByCompany(leadsRaw ?? []) as Lead[], [leadsRaw, filterByCompany]);
  const deals: Deal[] = useMemo(() => filterByCompany(dealsRaw ?? []) as Deal[], [dealsRaw, filterByCompany]);
  const contacts: Contact[] = useMemo(() => filterByCompany(contactsRaw ?? []) as Contact[], [contactsRaw, filterByCompany]);

  const create = useCreateActivity({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/activities"] });
        setOpen(false);
        setForm(emptyForm);
        toast({ title: "Activity created" });
      },
    },
  });

  const update = useUpdateActivity({
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
        toast({ title: "Activity deleted" });
      },
    },
  });

  const activities: Activity[] = useMemo(() => {
    let rows = filterByCompany(activitiesRaw ?? []) as Activity[];
    if (typeFilter !== "all") rows = rows.filter(a => a.type === typeFilter);
    if (leadFilter !== "all") rows = rows.filter(a => String(a.leadId) === leadFilter);
    if (dealFilter !== "all") rows = rows.filter(a => String(a.dealId) === dealFilter);
    if (contactFilter !== "all") rows = rows.filter(a => String(a.contactId) === contactFilter);
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(a =>
        a.subject.toLowerCase().includes(s) ||
        (a.description ?? "").toLowerCase().includes(s),
      );
    }
    return rows;
  }, [activitiesRaw, typeFilter, leadFilter, dealFilter, contactFilter, search]);

  const today = new Date().toISOString().slice(0, 10);
  const pending = activities.filter(a => !a.isDone);
  const overdue = pending.filter(a => a.dueDate && a.dueDate < today);
  const doneList = activities.filter(a => a.isDone);

  const markDone = (a: Activity) => {
    update.mutate({
      id: a.id,
      data: { type: a.type, subject: a.subject, isDone: true, leadId: a.leadId, dealId: a.dealId, contactId: a.contactId },
    });
  };

  const openEdit = (a: Activity) => {
    setEditActivity(a);
    setEditForm(activityToForm(a));
  };

  return (
    <div className="space-y-4">
      <ExecutiveHeader icon={ActivityIcon} title="Activities" subtitle="Log calls, meetings, tasks and follow-ups across all your CRM records">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-white text-[#0f2d5a] hover:bg-white/90">
              <Plus className="w-4 h-4 mr-2" />New Activity
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New Activity</DialogTitle></DialogHeader>
            <ActivityFormFields form={form} setForm={setForm} leads={leads} deals={deals} contacts={contacts} />
            <Button
              className="mt-2 bg-[#0f2d5a] hover:bg-[#1e6ab0]"
              onClick={() => create.mutate({ data: formToBody(form) })}
              disabled={!form.subject || create.isPending}
            >{create.isPending ? "Saving…" : "Create Activity"}</Button>
          </DialogContent>
        </Dialog>
      </ExecutiveHeader>

      <div className="grid grid-cols-3 gap-3">
        <KPIWidget icon={ActivityIcon}  tone="blue"  label="Total Activities" value={activities.length} sub="All types" />
        <KPIWidget icon={AlertTriangle} tone="red"   label="Overdue"          value={overdue.length}    sub="Past due date" />
        <KPIWidget icon={CheckCircle2}  tone="green" label="Completed"        value={doneList.length}   sub="Done" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search activities…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {ACTIVITY_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={leadFilter} onValueChange={setLeadFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Leads" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Leads</SelectItem>
            {leads.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.leadName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={dealFilter} onValueChange={setDealFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Deals" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Deals</SelectItem>
            {deals.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={contactFilter} onValueChange={setContactFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Contacts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Contacts</SelectItem>
            {contacts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue={overdue.length > 0 ? "overdue" : "pending"} className="w-full">
        <TabsList>
          <TabsTrigger value="overdue" className="data-[state=active]:text-red-700">
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />Overdue ({overdue.length})
          </TabsTrigger>
          <TabsTrigger value="pending"><Clock className="w-3.5 h-3.5 mr-1.5" />Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="all"><ActivityIcon className="w-3.5 h-3.5 mr-1.5" />All ({activities.length})</TabsTrigger>
          <TabsTrigger value="done"><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Done ({doneList.length})</TabsTrigger>
        </TabsList>

        {(["overdue", "pending", "all", "done"] as const).map(tab => {
          const rows = tab === "overdue" ? overdue : tab === "pending" ? pending : tab === "done" ? doneList : activities;
          return (
            <TabsContent key={tab} value={tab} className="mt-3">
              <ActivityTable
                activities={rows}
                isLoading={isLoading}
                leads={leads}
                deals={deals}
                contacts={contacts}
                today={today}
                onMarkDone={markDone}
                onEdit={openEdit}
                onDelete={a => { if (confirm("Delete this activity?")) deleteActivity.mutate({ id: a.id }); }}
              />
            </TabsContent>
          );
        })}
      </Tabs>

      <Dialog open={!!editActivity} onOpenChange={o => !o && setEditActivity(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Activity</DialogTitle></DialogHeader>
          <ActivityFormFields form={editForm} setForm={setEditForm} leads={leads} deals={deals} contacts={contacts} />
          <Button
            className="mt-2 bg-[#0f2d5a] hover:bg-[#1e6ab0]"
            onClick={() => editActivity && update.mutate({ id: editActivity.id, data: formToBody(editForm) })}
            disabled={!editForm.subject || update.isPending}
          >{update.isPending ? "Saving…" : "Save Changes"}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActivityTable({ activities, isLoading, leads, deals, contacts, today, onMarkDone, onEdit, onDelete }: {
  activities: Activity[];
  isLoading: boolean;
  leads: Lead[];
  deals: Deal[];
  contacts: Contact[];
  today: string;
  onMarkDone: (a: Activity) => void;
  onEdit: (a: Activity) => void;
  onDelete: (a: Activity) => void;
}) {
  if (isLoading) {
    return <div className="bg-card border rounded-xl p-10 text-center text-muted-foreground text-sm">Loading activities…</div>;
  }
  if (activities.length === 0) {
    return <div className="bg-card border rounded-xl p-10 text-center text-muted-foreground text-sm italic">No activities found.</div>;
  }
  return (
    <div className="border rounded-lg bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Linked To</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.map(a => {
            const Icon = TYPE_ICON[a.type] ?? ActivityIcon;
            const linkedLead = a.leadId ? leads.find(l => l.id === a.leadId) : undefined;
            const linkedDeal = a.dealId ? deals.find(d => d.id === a.dealId) : undefined;
            const linkedContact = a.contactId ? contacts.find(c => c.id === a.contactId) : undefined;
            const isOverdue = !a.isDone && !!a.dueDate && a.dueDate < today;
            return (
              <TableRow key={a.id} className={`hover:bg-muted/40 ${a.isDone ? "opacity-60" : ""}`}>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-4 h-4 text-[#1e6ab0]" />
                    <span className="text-xs capitalize">{a.type.replace("_", " ")}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className={`font-medium text-sm ${a.isDone ? "line-through text-muted-foreground" : ""}`}>{a.subject}</div>
                  {a.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{a.description}</div>}
                </TableCell>
                <TableCell>
                  {a.dueDate ? (
                    <span className={`text-sm ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                      {isOverdue && <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />}
                      {a.dueDate}
                    </span>
                  ) : <span className="text-muted-foreground text-sm">—</span>}
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    {linkedLead && (
                      <Link href={`/crm/leads/${linkedLead.id}`} className="block text-xs text-primary hover:underline truncate max-w-[140px]">
                        Lead: {linkedLead.leadName}
                      </Link>
                    )}
                    {linkedDeal && (
                      <Link href={`/crm/deals/${linkedDeal.id}`} className="block text-xs text-primary hover:underline truncate max-w-[140px]">
                        Deal: {linkedDeal.title}
                      </Link>
                    )}
                    {linkedContact && (
                      <Link href={`/crm/contacts/${linkedContact.id}`} className="block text-xs text-primary hover:underline truncate max-w-[140px]">
                        Contact: {linkedContact.name}
                      </Link>
                    )}
                    {!linkedLead && !linkedDeal && !linkedContact && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </TableCell>
                <TableCell>
                  {a.isDone
                    ? <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">Done</Badge>
                    : <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs">Pending</Badge>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{a.createdByName || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {!a.isDone && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => onMarkDone(a)}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Done
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(a)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => onDelete(a)}>
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
  );
}

function ActivityFormFields({ form, setForm, leads, deals, contacts }: {
  form: ActivityForm;
  setForm: React.Dispatch<React.SetStateAction<ActivityForm>>;
  leads: Lead[];
  deals: Deal[];
  contacts: Contact[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 pt-1 max-h-[60vh] overflow-y-auto pr-1">
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
        <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. Discovery call with Ahmed" />
      </div>
      <div className="col-span-2 space-y-1">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} />
      </div>
      <div className="col-span-2 space-y-1">
        <Label>Link to Lead</Label>
        <Select value={form.leadId || "none"} onValueChange={v => setForm(p => ({ ...p, leadId: v === "none" ? "" : v }))}>
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {leads.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.leadName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 space-y-1">
        <Label>Link to Deal</Label>
        <Select value={form.dealId || "none"} onValueChange={v => setForm(p => ({ ...p, dealId: v === "none" ? "" : v }))}>
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {deals.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 space-y-1">
        <Label>Link to Contact</Label>
        <Select value={form.contactId || "none"} onValueChange={v => setForm(p => ({ ...p, contactId: v === "none" ? "" : v }))}>
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {contacts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.companyName ? ` – ${c.companyName}` : ""}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 flex items-center gap-2">
        <Checkbox
          id="isDone"
          checked={form.isDone}
          onCheckedChange={v => setForm(p => ({ ...p, isDone: !!v }))}
        />
        <Label htmlFor="isDone" className="cursor-pointer">Mark as done</Label>
      </div>
    </div>
  );
}
