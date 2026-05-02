import { useMemo, useState } from "react";
import { useListLeads, useCreateLead, useUpdateLead, useListCompanies, useListUsers } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, MessageCircle, Filter, ArrowLeft, X, Sparkles, CheckSquare, Upload, UserPlus } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { LeadCsvImport } from "@/components/crm/LeadCsvImport";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const SOURCES = ["website", "referral", "social_media", "cold_call", "exhibition", "walk_in", "tender", "other"];
const STATUSES = ["new", "contacted", "qualified", "site_visit", "quotation_required", "quotation_sent", "negotiation", "won", "lost"];
const SCORES = ["hot", "warm", "cold"];

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

export function LeadsList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    leadName: "", companyName: "", contactPerson: "", phone: "", whatsapp: "",
    email: "", location: "", source: "referral", requirementType: "",
    budget: "", leadScore: "warm", status: "new", companyId: "", notes: "", nextFollowUp: "",
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const { data: leads, isLoading } = useListLeads({ search: search || undefined });
  const { data: companies } = useListCompanies();
  const { data: users } = useListUsers();
  const salesUsers = (users ?? []).filter((u: any) =>
    ["sales", "sales_manager", "manager", "main_admin", "admin"].includes((u.role ?? "").toLowerCase())
    || (u.role ?? "").toLowerCase().includes("sales"),
  );
  const create = useCreateLead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/leads"] });
        setOpen(false);
        setForm({ leadName: "", companyName: "", contactPerson: "", phone: "", whatsapp: "", email: "", location: "", source: "referral", requirementType: "", budget: "", leadScore: "warm", status: "new", companyId: "", notes: "", nextFollowUp: "" });
      },
    },
  });
  const update = useUpdateLead({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/leads"] }) },
  });

  const { filterByCompany } = useActiveCompany();
  const filtered = useMemo(() => filterByCompany(leads ?? []).filter(l => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (scoreFilter !== "all" && l.leadScore !== scoreFilter) return false;
    return true;
  }), [leads, filterByCompany, statusFilter, scoreFilter]);

  const allSelected = filtered.length > 0 && filtered.every(l => selected.has(l.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map(l => l.id)));
  };
  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const bulkUpdate = async (patch: Record<string, unknown>, label: string) => {
    const targets = filtered.filter(l => selected.has(l.id));
    if (targets.length === 0) return;
    await Promise.all(targets.map(l => update.mutateAsync({ id: l.id, data: { ...l, ...patch } as any })));
    toast({ title: `${label} applied`, description: `Updated ${targets.length} lead${targets.length === 1 ? "" : "s"}` });
    clearSelection();
  };

  const hot = leads?.filter(l => l.leadScore === "hot").length ?? 0;
  const won = leads?.filter(l => l.status === "won").length ?? 0;
  const active = leads?.filter(l => !["won","lost"].includes(l.status)).length ?? 0;

  const exportColumns = [
    { header: "Lead Ref", key: "leadNumber" },
    { header: "Lead Name", key: "leadName" },
    { header: "Company", key: "companyName" },
    { header: "Phone", key: "phone" },
    { header: "Email", key: "email" },
    { header: "Score", key: "leadScore" },
    { header: "Status", key: "status" },
    { header: "Source", key: "source" },
    { header: "Est. Value (AED)", key: "estimatedValue", format: (v: unknown) => Number(v ?? 0).toFixed(2) },
    { header: "Next Follow-up", key: "nextFollowUp" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/crm">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />Back to CRM
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">Manage your sales prospects and inquiries.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={(filtered ?? []) as unknown as Record<string, unknown>[]}
            columns={exportColumns}
            filename="leads"
            title="Leads"
            defaultLandscape={true}
          />
          <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="button-import-leads">
            <Upload className="w-4 h-4 mr-2" />Import CSV
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]">
              <Plus className="w-4 h-4 mr-2" />Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New Lead</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 pt-2 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-1 col-span-2"><Label>Lead / Client Name *</Label><Input value={form.leadName} onChange={e => setForm(p => ({...p, leadName: e.target.value}))} placeholder="Full name or company name" /></div>
              <div className="space-y-1"><Label>Company Name</Label><Input value={form.companyName} onChange={e => setForm(p => ({...p, companyName: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Contact Person</Label><Input value={form.contactPerson} onChange={e => setForm(p => ({...p, contactPerson: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} placeholder="+971 50 xxx xxxx" /></div>
              <div className="space-y-1"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm(p => ({...p, whatsapp: e.target.value}))} placeholder="+971 50 xxx xxxx" /></div>
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Location / Emirates</Label><Input value={form.location} onChange={e => setForm(p => ({...p, location: e.target.value}))} placeholder="Dubai, Abu Dhabi, Sharjah..." /></div>
              <div className="space-y-1"><Label>Source</Label>
                <Select value={form.source} onValueChange={v => setForm(p => ({...p, source: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Requirement Type</Label><Input value={form.requirementType} onChange={e => setForm(p => ({...p, requirementType: e.target.value}))} placeholder="Villa, Labour Camp, Warehouse..." /></div>
              <div className="space-y-1"><Label>Budget (AED)</Label><Input type="number" value={form.budget} onChange={e => setForm(p => ({...p, budget: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Lead Score</Label>
                <Select value={form.leadScore} onValueChange={v => setForm(p => ({...p, leadScore: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hot">🔥 Hot</SelectItem>
                    <SelectItem value="warm">🌡️ Warm</SelectItem>
                    <SelectItem value="cold">❄️ Cold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({...p, status: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Company *</Label>
                <Select value={form.companyId} onValueChange={v => setForm(p => ({...p, companyId: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>{companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.shortName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Next Follow-up</Label><Input type="date" value={form.nextFollowUp} onChange={e => setForm(p => ({...p, nextFollowUp: e.target.value}))} /></div>
              <div className="space-y-1 col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={3} placeholder="Additional notes about the lead..." /></div>
            </div>
            <Button
              className="mt-4 bg-[#0f2d5a] hover:bg-[#1e6ab0]"
              onClick={() => create.mutate({ data: { ...form, companyId: parseInt(form.companyId, 10), budget: form.budget ? parseFloat(form.budget) : undefined } as any })}
              disabled={!form.leadName || !form.companyId || create.isPending}
            >
              {create.isPending ? "Saving..." : "Create Lead"}
            </Button>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center"><span className="text-lg">🔥</span></div>
          <div><div className="text-2xl font-bold text-red-600">{hot}</div><div className="text-xs text-muted-foreground">Hot Leads</div></div>
        </div>
        <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center"><span className="text-lg">📋</span></div>
          <div><div className="text-2xl font-bold text-blue-600">{active}</div><div className="text-xs text-muted-foreground">Active Leads</div></div>
        </div>
        <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center"><span className="text-lg">✅</span></div>
          <div><div className="text-2xl font-bold text-green-600">{won}</div><div className="text-xs text-muted-foreground">Won</div></div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={scoreFilter} onValueChange={setScoreFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Scores" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scores</SelectItem>
            <SelectItem value="hot">🔥 Hot</SelectItem>
            <SelectItem value="warm">🌡️ Warm</SelectItem>
            <SelectItem value="cold">❄️ Cold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="bg-[#0f2d5a]/5 border border-[#1e6ab0]/30 rounded-lg p-3 flex items-center gap-3 flex-wrap" data-testid="bulk-toolbar">
          <CheckSquare className="w-4 h-4 text-[#1e6ab0]" />
          <span className="text-sm font-medium">{selected.size} selected</span>
          <span className="text-xs text-muted-foreground">Bulk actions:</span>
          <Select onValueChange={v => bulkUpdate({ status: v }, `Status → ${v}`)}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Set status…" /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}</SelectContent>
          </Select>
          <Select onValueChange={v => bulkUpdate({ leadScore: v }, `Score → ${v}`)}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Set score…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hot">🔥 Hot</SelectItem>
              <SelectItem value="warm">🌡️ Warm</SelectItem>
              <SelectItem value="cold">❄️ Cold</SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={v => bulkUpdate({ assignedToId: parseInt(v, 10) }, `Assigned`)}>
            <SelectTrigger className="h-8 w-44 text-xs"><UserPlus className="w-3 h-3 mr-1.5 text-muted-foreground" /><SelectValue placeholder="Assign to…" /></SelectTrigger>
            <SelectContent>
              {salesUsers.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-8" onClick={() => bulkUpdate({ isActive: false }, "Archived")} data-testid="button-bulk-archive">Archive</Button>
          <Button size="sm" variant="ghost" className="h-8 ml-auto" onClick={clearSelection}><X className="w-3.5 h-3.5 mr-1" />Clear</Button>
        </div>
      )}

      <LeadCsvImport open={importOpen} onOpenChange={setImportOpen} companyId={companies?.[0]?.id} />

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" data-testid="checkbox-select-all" />
              </TableHead>
              <TableHead>Lead Ref</TableHead>
              <TableHead>Name / Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Follow-up</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading leads...</TableCell></TableRow>
            ) : filtered?.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No leads found. Add your first lead to get started.</TableCell></TableRow>
            ) : (
              filtered?.map((lead) => (
                <TableRow key={lead.id} className={`hover:bg-muted/30 ${selected.has(lead.id) ? "bg-[#1e6ab0]/5" : ""}`}>
                  <TableCell>
                    <Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggleOne(lead.id)} aria-label={`Select ${lead.leadName}`} data-testid={`checkbox-lead-${lead.id}`} />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/crm/leads/${lead.id}`} className="hover:underline text-primary font-mono text-sm">
                      {lead.leadNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{lead.leadName}</div>
                    {lead.companyName && <div className="text-xs text-muted-foreground">{lead.companyName}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{lead.phone || lead.email || "-"}</div>
                  </TableCell>
                  <TableCell className="capitalize text-sm">{lead.source?.replace("_"," ") || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={scoreColors[lead.leadScore ?? ""] ?? "bg-slate-100 text-slate-700"}>
                      {lead.leadScore}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[lead.status] ?? ""}>
                      {lead.status?.replace("_"," ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lead.nextFollowUp || "-"}</TableCell>
                  <TableCell>
                    {lead.whatsapp && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={`https://wa.me/${lead.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" title="WhatsApp">
                          <MessageCircle className="w-4 h-4 text-green-600" />
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
