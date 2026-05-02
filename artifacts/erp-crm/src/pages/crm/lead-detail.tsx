import { useState } from "react";
import { useGetLead, useUpdateLead } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { ArrowLeft, Pencil, MessageCircle, Phone, Mail, MapPin, Calendar, Building2, DollarSign, X, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const scoreColors: Record<string, string> = {
  hot: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  warm: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  cold: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  contacted: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  qualified: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  site_visit: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  quotation_required: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  quotation_sent: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  negotiation: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
  won: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  lost: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const STATUSES = ["new","contacted","qualified","site_visit","quotation_required","quotation_sent","negotiation","won","lost"];

interface Props { id: string }

export function LeadDetail({ id }: Props) {
  const lid = parseInt(id, 10);
  const queryClient = useQueryClient();
  const { data: lead, isLoading } = useGetLead(lid);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const update = useUpdateLead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/leads"] });
        setEditing(false);
      },
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading lead details...</div>;
  if (!lead) return <div className="text-muted-foreground p-8">Lead not found.</div>;

  const startEditing = () => {
    setForm({
      leadName: (lead as any).leadName ?? "",
      companyName: (lead as any).companyName ?? "",
      contactPerson: (lead as any).contactPerson ?? "",
      phone: (lead as any).phone ?? "",
      whatsapp: (lead as any).whatsapp ?? "",
      email: (lead as any).email ?? "",
      location: (lead as any).location ?? "",
      requirementType: (lead as any).requirementType ?? "",
      budget: String((lead as any).budget ?? ""),
      leadScore: (lead as any).leadScore ?? "cold",
      status: (lead as any).status ?? "new",
      notes: (lead as any).notes ?? "",
      nextFollowUp: (lead as any).nextFollowUp ?? "",
    });
    setEditing(true);
  };

  const saveEdit = () => {
    update.mutate({ id: lid, data: { ...form, budget: form.budget ? parseFloat(form.budget) : undefined } as any });
  };

  const l = lead as any;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/crm/leads"><ArrowLeft className="w-4 h-4 mr-1" />Back to Leads</Link>
        </Button>
        <div className="ml-auto flex gap-2">
          {!editing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="w-4 h-4 mr-1.5" />Edit Lead
            </Button>
          )}
          {editing && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="w-4 h-4 mr-1.5" />Cancel</Button>
              <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={saveEdit} disabled={update.isPending}>
                <Save className="w-4 h-4 mr-1.5" />{update.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}
          {l.whatsapp && (
            <Button variant="outline" size="sm" asChild>
              <a href={`https://wa.me/${l.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer">
                <MessageCircle className="w-4 h-4 mr-1.5 text-green-600" />WhatsApp
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card border rounded-xl p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            {editing ? (
              <div className="space-y-1">
                <Label>Lead / Client Name</Label>
                <Input value={form.leadName} onChange={e => setForm(p => ({...p, leadName: e.target.value}))} className="text-xl font-bold h-auto py-1" />
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold">{l.leadName}</h1>
                {l.companyName && <p className="text-muted-foreground text-sm mt-0.5">{l.companyName}</p>}
              </>
            )}
            <div className="font-mono text-sm text-primary mt-1">{l.leadNumber}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {editing ? (
              <Select value={form.leadScore} onValueChange={v => setForm(p => ({...p, leadScore: v}))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot">🔥 Hot</SelectItem>
                  <SelectItem value="warm">🌡️ Warm</SelectItem>
                  <SelectItem value="cold">❄️ Cold</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="secondary" className={scoreColors[l.leadScore ?? ""] ?? "bg-slate-100 text-slate-700"}>
                {l.leadScore}
              </Badge>
            )}
            {editing ? (
              <Select value={form.status} onValueChange={v => setForm(p => ({...p, status: v}))}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Badge variant="secondary" className={`${statusColors[l.status] ?? ""} capitalize`}>
                {l.status?.replace("_"," ")}
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Information</h3>
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1"><Label>Contact Person</Label><Input value={form.contactPerson} onChange={e => setForm(p => ({...p, contactPerson: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} /></div>
                <div className="space-y-1"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm(p => ({...p, whatsapp: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} /></div>
              </div>
            ) : (
              <div className="space-y-3">
                {l.contactPerson && <div className="flex items-center gap-2 text-sm"><Building2 className="w-4 h-4 text-muted-foreground" />{l.contactPerson}</div>}
                {l.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" /><a href={`tel:${l.phone}`} className="hover:underline text-primary">{l.phone}</a></div>}
                {l.whatsapp && <div className="flex items-center gap-2 text-sm"><MessageCircle className="w-4 h-4 text-green-600" /><a href={`https://wa.me/${l.whatsapp.replace(/[^0-9]/g,"")}`} target="_blank" rel="noreferrer" className="hover:underline text-green-600">{l.whatsapp}</a></div>}
                {l.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" /><a href={`mailto:${l.email}`} className="hover:underline text-primary">{l.email}</a></div>}
                {l.location && <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-muted-foreground" />{l.location}</div>}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Requirement Details</h3>
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1"><Label>Company Name</Label><Input value={form.companyName} onChange={e => setForm(p => ({...p, companyName: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Location</Label><Input value={form.location} onChange={e => setForm(p => ({...p, location: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Requirement Type</Label><Input value={form.requirementType} onChange={e => setForm(p => ({...p, requirementType: e.target.value}))} placeholder="Villa, Labour Camp, Warehouse..." /></div>
                <div className="space-y-1"><Label>Budget (AED)</Label><Input type="number" value={form.budget} onChange={e => setForm(p => ({...p, budget: e.target.value}))} /></div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Requirement</span><span className="font-medium">{l.requirementType || "-"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span className="font-medium">{l.budget ? `AED ${parseFloat(l.budget).toLocaleString()}` : "-"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span className="font-medium capitalize">{l.source?.replace("_"," ") || "-"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Assigned To</span><span className="font-medium">{l.assignedToName || "-"}</span></div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Follow-up</h3>
            {editing ? (
              <div className="space-y-1"><Label>Next Follow-up Date</Label><Input type="date" value={form.nextFollowUp} onChange={e => setForm(p => ({...p, nextFollowUp: e.target.value}))} /></div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleDateString("en-AE", { dateStyle: "long" }) : "No follow-up scheduled"}</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Created: {new Date(l.createdAt).toLocaleDateString("en-AE", { dateStyle: "long" })}</div>
              {l.updatedAt && <div>Last updated: {new Date(l.updatedAt).toLocaleDateString("en-AE", { dateStyle: "long" })}</div>}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</h3>
          {editing ? (
            <Textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={4} placeholder="Additional notes..." />
          ) : (
            <div className="p-3 bg-muted/30 rounded-lg text-sm min-h-[80px]">
              {l.notes || <span className="text-muted-foreground italic">No notes added.</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
