import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useListLeads, useUpdateLead, useListActivities, useUpdateActivity,
  getListActivitiesQueryKey,
} from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Clock, AlertTriangle, CalendarDays, MessageCircle, Phone, Mail,
  CheckCircle2, ArrowRight, Search, Sparkles, ListChecks,
} from "lucide-react";

type FollowUpItem = {
  kind: "lead" | "activity";
  id: number;
  date: string;          // ISO yyyy-mm-dd
  primary: string;       // lead name or activity subject
  secondary?: string;    // company / requirement
  refId: number;         // lead id (for navigation)
  raw: any;
  type?: string;         // activity type
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const inDaysISO = (d: number) => {
  const t = new Date(); t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
};

export function FollowUpCenter() {
  const { data: leadsRaw } = useListLeads({});
  const { data: activitiesRaw } = useListActivities();
  const { filterByCompany } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [reschedule, setReschedule] = useState<{ leadId: number; current: string } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const leads = useMemo(() => filterByCompany(leadsRaw ?? []), [leadsRaw, filterByCompany]);
  const activities = useMemo(() => filterByCompany(activitiesRaw ?? []), [activitiesRaw, filterByCompany]);

  const updateLead = useUpdateLead({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/leads"] }) },
  });
  const updateActivity = useUpdateActivity({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() }) },
  });

  // Build a unified list of follow-up items from leads + activities
  const items = useMemo(() => {
    const out: FollowUpItem[] = [];
    for (const l of leads) {
      if (l.nextFollowUp && !["won", "lost"].includes(l.status)) {
        out.push({
          kind: "lead", id: l.id, date: l.nextFollowUp, primary: l.leadName,
          secondary: [l.companyName, l.requirementType].filter(Boolean).join(" · "),
          refId: l.id, raw: l,
        });
      }
    }
    for (const a of activities) {
      if (a.dueDate && !a.isDone && a.leadId) {
        const lead = leads.find(x => x.id === a.leadId);
        if (!lead) continue;
        out.push({
          kind: "activity", id: a.id, date: a.dueDate, primary: a.subject,
          secondary: `${a.type?.replace("_", " ")} · ${lead.leadName}`,
          refId: a.leadId, raw: a, type: a.type,
        });
      }
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    if (search) {
      const s = search.toLowerCase();
      return out.filter(i => i.primary.toLowerCase().includes(s) || (i.secondary ?? "").toLowerCase().includes(s));
    }
    return out;
  }, [leads, activities, search]);

  const today = todayISO();
  const week = inDaysISO(7);
  const overdue  = items.filter(i => i.date < today);
  const todayList = items.filter(i => i.date === today);
  const upcoming = items.filter(i => i.date > today && i.date <= week);
  const later    = items.filter(i => i.date > week);

  const markDone = (item: FollowUpItem) => {
    if (item.kind === "activity") {
      updateActivity.mutate({ id: item.id, data: { ...item.raw, isDone: true } as any },
        { onSuccess: () => toast({ title: "Marked as done", description: item.primary }) });
    } else {
      // For lead-attached follow-ups, log a "completed" activity by clearing the next follow-up.
      updateLead.mutate({ id: item.id, data: { ...item.raw, nextFollowUp: null } as any },
        { onSuccess: () => toast({ title: "Follow-up cleared", description: item.primary }) });
    }
  };

  const openReschedule = (item: FollowUpItem) => {
    if (item.kind !== "lead") return;
    setReschedule({ leadId: item.id, current: item.date });
    // Pre-fill with the existing follow-up date so a careless save doesn't move it.
    setRescheduleDate(item.date || inDaysISO(2));
  };

  const submitReschedule = () => {
    if (!reschedule) return;
    const lead = leads.find(l => l.id === reschedule.leadId);
    if (!lead) return;
    updateLead.mutate({ id: lead.id, data: { ...lead, nextFollowUp: rescheduleDate } as any }, {
      onSuccess: () => {
        toast({ title: "Rescheduled", description: `${lead.leadName} → ${rescheduleDate}` });
        setReschedule(null);
      },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Follow-up Center</h1>
          <p className="text-muted-foreground text-sm">Every lead and activity that needs your attention — keep nothing on the back burner.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link href="/crm"><ArrowRight className="w-4 h-4 mr-1.5 rotate-180" />Back to CRM</Link></Button>
          <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" asChild><Link href="/crm/leads">Open Leads</Link></Button>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={AlertTriangle} label="Overdue"     value={overdue.length}  tone="red"   />
        <StatCard icon={Clock}         label="Today"       value={todayList.length} tone="amber" />
        <StatCard icon={Calendar}      label="This Week"   value={upcoming.length} tone="blue"  />
        <StatCard icon={CalendarDays}  label="Later"       value={later.length}    tone="slate" />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search follow-ups…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-followup-search" />
      </div>

      <Tabs defaultValue={overdue.length > 0 ? "overdue" : "today"} className="w-full">
        <TabsList>
          <TabsTrigger value="overdue" className="data-[state=active]:text-red-700"><AlertTriangle className="w-3.5 h-3.5 mr-1.5" />Overdue ({overdue.length})</TabsTrigger>
          <TabsTrigger value="today"><Clock className="w-3.5 h-3.5 mr-1.5" />Today ({todayList.length})</TabsTrigger>
          <TabsTrigger value="upcoming"><Calendar className="w-3.5 h-3.5 mr-1.5" />This Week ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="all"><ListChecks className="w-3.5 h-3.5 mr-1.5" />All ({items.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overdue"  className="mt-3"><FollowUpList items={overdue} emptyText="No overdue follow-ups." overdue onDone={markDone} onReschedule={openReschedule} /></TabsContent>
        <TabsContent value="today"    className="mt-3"><FollowUpList items={todayList} emptyText="Nothing due today." onDone={markDone} onReschedule={openReschedule} /></TabsContent>
        <TabsContent value="upcoming" className="mt-3"><FollowUpList items={upcoming} emptyText="No follow-ups in the next 7 days." onDone={markDone} onReschedule={openReschedule} /></TabsContent>
        <TabsContent value="all"      className="mt-3"><FollowUpList items={items} emptyText="Nothing scheduled." onDone={markDone} onReschedule={openReschedule} /></TabsContent>
      </Tabs>

      {/* Reschedule dialog */}
      <Dialog open={!!reschedule} onOpenChange={(o) => !o && setReschedule(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reschedule Follow-up</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="text-xs text-muted-foreground">Current: {reschedule?.current ?? "-"}</div>
            <div className="space-y-1">
              <Label>New date</Label>
              <Input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setRescheduleDate(inDaysISO(1))}>+1 day</Button>
              <Button size="sm" variant="outline" onClick={() => setRescheduleDate(inDaysISO(3))}>+3 days</Button>
              <Button size="sm" variant="outline" onClick={() => setRescheduleDate(inDaysISO(7))}>+7 days</Button>
            </div>
            <Button className="w-full bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={submitReschedule}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number; tone: "red" | "amber" | "blue" | "slate";
}) {
  const colors = {
    red:   "bg-red-100 text-red-700",
    amber: "bg-orange-100 text-orange-700",
    blue:  "bg-blue-100 text-blue-700",
    slate: "bg-slate-100 text-slate-700",
  }[tone];
  return (
    <div className="bg-card border rounded-xl p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors}`}><Icon className="w-5 h-5" /></div>
      <div>
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  );
}

function FollowUpList({ items, emptyText, overdue, onDone, onReschedule }: {
  items: FollowUpItem[]; emptyText: string; overdue?: boolean;
  onDone: (i: FollowUpItem) => void; onReschedule: (i: FollowUpItem) => void;
}) {
  if (items.length === 0) return <div className="bg-card border rounded-xl p-10 text-sm text-muted-foreground italic text-center">{emptyText}</div>;
  return (
    <div className="bg-card border rounded-xl divide-y">
      {items.map(item => {
        const lead = item.raw;
        const phone = item.kind === "lead" ? lead.phone : null;
        const whatsapp = item.kind === "lead" ? lead.whatsapp : null;
        const email = item.kind === "lead" ? lead.email : null;
        const isLead = item.kind === "lead";
        const score = lead.leadScore;
        return (
          <div key={`${item.kind}-${item.id}`} className="p-3 flex items-center gap-3 hover:bg-muted/30">
            <div className={`w-1 h-12 rounded-full shrink-0 ${overdue ? "bg-red-500" : item.date === todayISO() ? "bg-orange-500" : "bg-blue-500"}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/crm/leads/${item.refId}`} className="font-medium text-sm hover:text-primary truncate">{item.primary}</Link>
                {isLead && score === "hot"  && <Badge variant="secondary" className="bg-red-100 text-red-700 text-[10px]">🔥 Hot</Badge>}
                {isLead && score === "warm" && <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-[10px]">🌡️ Warm</Badge>}
                {!isLead && <Badge variant="outline" className="capitalize text-[10px]">{item.type?.replace("_", " ")}</Badge>}
              </div>
              <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                {overdue ? <span className="text-red-600 font-medium">OVERDUE </span> : null}
                {item.date}{item.secondary ? ` · ${item.secondary}` : ""}
              </div>
            </div>
            {phone    && <a href={`tel:${phone}`}                                                            aria-label={`Call ${item.primary}`}     title="Call"     className="text-blue-600 hover:text-blue-700"><Phone className="w-4 h-4" /></a>}
            {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${item.primary}`} title="WhatsApp" className="text-green-600 hover:text-green-700"><MessageCircle className="w-4 h-4" /></a>}
            {email    && <a href={`mailto:${email}`}                                                          aria-label={`Email ${item.primary}`}    title="Email"    className="text-muted-foreground hover:text-foreground"><Mail className="w-4 h-4" /></a>}
            {isLead && (
              <Button size="sm" variant="ghost" onClick={() => onReschedule(item)} className="h-7 px-2 text-[11px]" data-testid={`button-reschedule-${item.id}`}>
                <Sparkles className="w-3 h-3 mr-1" />Reschedule
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onDone(item)} className="h-7 px-2 text-[11px]" data-testid={`button-done-${item.kind}-${item.id}`}>
              <CheckCircle2 className="w-3 h-3 mr-1" />Done
            </Button>
          </div>
        );
      })}
    </div>
  );
}
