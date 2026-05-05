import { useEffect, useMemo, useState } from "react";
import { useListLeads, useCreateLead, useUpdateLead, useListCompanies, useListUsers, getListLeadsQueryKey } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyField } from "@/components/CompanyField";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Filter, X, CheckSquare, Upload, UserPlus, Phone, Mail, Calendar as CalendarIcon, Users, Flame } from "lucide-react";
import { WhatsAppQuickIcon } from "@/components/whatsapp-button";
import { ExportMenu } from "@/components/ExportMenu";
import { LeadCsvImport } from "@/components/crm/LeadCsvImport";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ExecutiveHeader, StatusBadge, AIScoreBadge, Avatar, KPIWidget } from "@/components/crm/premium";

const SOURCES = ["website", "referral", "social_media", "cold_call", "exhibition", "walk_in", "tender", "other"];
const STATUSES = ["new", "contacted", "qualified", "site_visit", "quotation_required", "quotation_sent", "negotiation", "won", "lost"];
const COMPANY_TYPES = ["LLC", "Sole Proprietorship", "Free Zone", "Branch", "Government", "Other"];
const MONTHS = [
  { v: "01", l: "January" }, { v: "02", l: "February" }, { v: "03", l: "March" },
  { v: "04", l: "April" }, { v: "05", l: "May" }, { v: "06", l: "June" },
  { v: "07", l: "July" }, { v: "08", l: "August" }, { v: "09", l: "September" },
  { v: "10", l: "October" }, { v: "11", l: "November" }, { v: "12", l: "December" },
];

const emptyForm = {
  leadName: "", companyName: "", contactPerson: "", designation: "", phone: "", whatsapp: "",
  email: "", location: "", source: "referral", requirementType: "",
  budget: "", leadScore: "warm", status: "new", companyId: "", notes: "", nextFollowUp: "",
  companyType: "", website: "", licenseNumber: "", trnNumber: "", officeAddress: "",
  contactId: undefined as number | undefined,
};

export function LeadsList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all"); // "all" | "01".."12"
  const [yearFilter, setYearFilter] = useState<string>(String(new Date().getFullYear()));
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
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
      onSuccess: (newLead: any) => {
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        setOpen(false);
        setForm(emptyForm);
        toast({
          title: "Lead created",
          description: newLead?.clientCode ? `Client Code: ${newLead.clientCode}` : `${newLead?.leadNumber ?? ""}`,
        });
      },
    },
  });
  const update = useUpdateLead({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() }) },
  });

  // Auto-open + prefill from /crm/contacts (Save & Convert / Convert To Lead).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openNew") === "1") {
      const stored = sessionStorage.getItem("prefillLeadFromContact");
      if (stored) {
        try {
          const c = JSON.parse(stored);
          setForm(prev => ({
            ...prev,
            leadName: c.name || prev.leadName,
            companyName: c.companyName || "",
            contactPerson: c.name || "",
            designation: c.designation || "",
            phone: c.phone || "",
            whatsapp: c.whatsapp || "",
            email: c.email || "",
            companyId: c.companyId ? String(c.companyId) : "",
            contactId: c.id,
          }));
          sessionStorage.removeItem("prefillLeadFromContact");
        } catch {}
      }
      setOpen(true);
      // Clean the URL so re-renders don't re-open the dialog.
      const url = new URL(window.location.href);
      url.searchParams.delete("openNew");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const { filterByCompany } = useActiveCompany();
  const filtered = useMemo(() => filterByCompany(leads ?? []).filter(l => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (scoreFilter !== "all" && l.leadScore !== scoreFilter) return false;
    const created = (l.createdAt ?? "").slice(0, 10); // YYYY-MM-DD
    if (monthFilter !== "all") {
      const mm = created.slice(5, 7);
      const yy = created.slice(0, 4);
      if (mm !== monthFilter || yy !== yearFilter) return false;
    }
    if (dateFrom && created < dateFrom) return false;
    if (dateTo && created > dateTo) return false;
    return true;
  }), [leads, filterByCompany, statusFilter, scoreFilter, monthFilter, yearFilter, dateFrom, dateTo]);

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
    { header: "Client Code", key: "clientCode" },
    { header: "Lead Name", key: "leadName" },
    { header: "Company", key: "companyName" },
    { header: "Phone", key: "phone" },
    { header: "Email", key: "email" },
    { header: "Score", key: "leadScore" },
    { header: "Status", key: "status" },
    { header: "Source", key: "source" },
    { header: "Next Follow-up", key: "nextFollowUp" },
  ];

  const yearOptions = (() => {
    const y = new Date().getFullYear();
    return [String(y - 1), String(y), String(y + 1)];
  })();

  const clearDateFilters = () => { setMonthFilter("all"); setDateFrom(""); setDateTo(""); };

  return (
    <div className="space-y-4">
      <ExecutiveHeader icon={Users} title="Leads" subtitle="Manage your sales prospects and inquiries">
        <ExportMenu
          data={(filtered ?? [])}
          columns={exportColumns}
          filename="leads"
          title="Leads"
          defaultLandscape={true}
        />
        <Button variant="secondary" size="sm" className="bg-white/15 hover:bg-white/25 text-white border-0" onClick={() => setImportOpen(true)} data-testid="button-import-leads">
          <Upload className="w-4 h-4 mr-2" />Import CSV
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-white text-[#0f2d5a] hover:bg-white/90">
              <Plus className="w-4 h-4 mr-2" />Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>New Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-1">
              {/* CONTACT SECTION */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 border-b pb-1">Contact</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2"><Label>Lead / Contact Name *</Label><Input value={form.leadName} onChange={e => setForm(p => ({...p, leadName: e.target.value, contactPerson: p.contactPerson || e.target.value}))} placeholder="Full name" /></div>
                  <div className="space-y-1"><Label>Designation</Label><Input value={form.designation} onChange={e => setForm(p => ({...p, designation: e.target.value}))} placeholder="Manager, Owner..." /></div>
                  <div className="space-y-1"><Label>Mobile</Label><Input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} placeholder="+971 50 xxx xxxx" /></div>
                  <div className="space-y-1"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm(p => ({...p, whatsapp: e.target.value}))} placeholder="+971 50 xxx xxxx" /></div>
                  <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} /></div>
                </div>
              </div>

              {/* COMPANY SECTION */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 border-b pb-1">Company</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2"><Label>Client Code</Label><Input value="(auto-generated on save)" disabled className="font-mono bg-muted" /></div>
                  <div className="space-y-1"><Label>Company Name (Legal)</Label><Input value={form.companyName} onChange={e => setForm(p => ({...p, companyName: e.target.value}))} /></div>
                  <div className="space-y-1"><Label>Company Type</Label>
                    <Select value={form.companyType} onValueChange={v => setForm(p => ({...p, companyType: v}))}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>{COMPANY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Website</Label><Input value={form.website} onChange={e => setForm(p => ({...p, website: e.target.value}))} placeholder="https://..." /></div>
                  <div className="space-y-1"><Label>License Number</Label><Input value={form.licenseNumber} onChange={e => setForm(p => ({...p, licenseNumber: e.target.value}))} /></div>
                  <div className="space-y-1"><Label>TRN Number</Label><Input value={form.trnNumber} onChange={e => setForm(p => ({...p, trnNumber: e.target.value}))} /></div>
                  <div className="space-y-1"><Label>Status</Label>
                    <Select value={form.status} onValueChange={v => setForm(p => ({...p, status: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 col-span-2"><Label>Office Address</Label><Textarea value={form.officeAddress} onChange={e => setForm(p => ({...p, officeAddress: e.target.value}))} rows={2} /></div>
                  <div className="space-y-1 col-span-2"><Label>Brand / Company *</Label>
                    <CompanyField value={form.companyId} onChange={v => setForm(p => ({...p, companyId: v}))} />
                    <p className="text-xs text-muted-foreground">Determines Client Code prefix (PM-CL- or EP-CL-).</p>
                  </div>
                </div>
              </div>

              {/* SALES SECTION */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 border-b pb-1">Sales</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Lead Source</Label>
                    <Select value={form.source} onValueChange={v => setForm(p => ({...p, source: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Requirement Type</Label><Input value={form.requirementType} onChange={e => setForm(p => ({...p, requirementType: e.target.value}))} placeholder="Villa, Labour Camp..." /></div>
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
                  <div className="space-y-1"><Label>Next Follow-up</Label><Input type="date" value={form.nextFollowUp} onChange={e => setForm(p => ({...p, nextFollowUp: e.target.value}))} /></div>
                  <div className="space-y-1"><Label>Location / Emirates</Label><Input value={form.location} onChange={e => setForm(p => ({...p, location: e.target.value}))} placeholder="Dubai, Abu Dhabi…" /></div>
                  <div className="space-y-1 col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={3} /></div>
                </div>
              </div>
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
      </ExecutiveHeader>

      <div className="grid grid-cols-3 gap-3">
        <KPIWidget icon={Flame}     tone="red"   label="Hot Leads"   value={hot}    sub={`${active} active`} />
        <KPIWidget icon={Users}     tone="blue"  label="Active Leads" value={active} sub="In progress" />
        <KPIWidget icon={CheckSquare} tone="green" label="Won"         value={won}   sub="Closed deals" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads (name / Client Code / company)..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
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
        <div className="flex items-center gap-1 border rounded-md px-2 py-1 bg-muted/30">
          <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-32 h-7 border-0 bg-transparent"><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {MONTHS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-20 h-7 border-0 bg-transparent"><SelectValue /></SelectTrigger>
            <SelectContent>{yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1 border rounded-md px-2 py-1 bg-muted/30">
          <span className="text-xs text-muted-foreground">From</span>
          <Input type="date" className="h-7 w-36 border-0 bg-transparent text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className="text-xs text-muted-foreground">To</span>
          <Input type="date" className="h-7 w-36 border-0 bg-transparent text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        {(monthFilter !== "all" || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={clearDateFilters}><X className="w-3 h-3 mr-1" />Clear dates</Button>
        )}
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
              <TableHead>Client Code</TableHead>
              <TableHead>Lead Ref</TableHead>
              <TableHead>Name / Company</TableHead>
              <TableHead>Contact</TableHead>
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
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No leads found for selected filters.</TableCell></TableRow>
            ) : (
              filtered?.map((lead) => (
                <TableRow
                  key={lead.id}
                  className={`group hover:bg-muted/40 transition-colors ${selected.has(lead.id) ? "bg-[#1e6ab0]/5" : ""}`}
                  data-testid={`row-lead-${lead.id}`}
                >
                  <TableCell>
                    <Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggleOne(lead.id)} aria-label={`Select ${lead.leadName}`} data-testid={`checkbox-lead-${lead.id}`} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{(lead as any).clientCode || "-"}</TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/crm/leads/${lead.id}`} className="hover:underline text-primary font-mono text-sm">
                      {lead.leadNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={lead.leadName} size={32} />
                      <div className="min-w-0">
                        <Link href={`/crm/leads/${lead.id}`} className="block">
                          <div className="font-medium truncate hover:text-primary transition-colors">{lead.leadName}</div>
                        </Link>
                        {lead.companyName && <div className="text-xs text-muted-foreground truncate">{lead.companyName}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{lead.phone || lead.email || "-"}</div>
                  </TableCell>
                  <TableCell>
                    <AIScoreBadge score={lead.leadScore ?? "warm"} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lead.nextFollowUp || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                      {lead.phone && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={`tel:${lead.phone}`} title="Call" aria-label={`Call ${lead.leadName}`} onClick={e => e.stopPropagation()}>
                            <Phone className="w-3.5 h-3.5 text-blue-600" />
                          </a>
                        </Button>
                      )}
                      {(lead.whatsapp || lead.phone) && (
                        <WhatsAppQuickIcon
                          phone={lead.whatsapp || lead.phone}
                          context="lead"
                          leadId={lead.id}
                          defaultTemplateId={lead.status === "new" ? "lead_intro" : "lead_followup"}
                          vars={{ name: lead.contactPerson || lead.leadName, companyName: lead.companyName }}
                          className="h-8 w-8"
                          testId={`button-wa-lead-${lead.id}`}
                        />
                      )}
                      {lead.email && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={`mailto:${lead.email}`} title="Email" aria-label={`Email ${lead.leadName}`} onClick={e => e.stopPropagation()}>
                            <Mail className="w-3.5 h-3.5 text-indigo-600" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/crm/leads/${lead.id}`} title="Open lead" aria-label={`Open ${lead.leadName}`}>
                          <CalendarIcon className="w-3.5 h-3.5 text-orange-600" />
                        </Link>
                      </Button>
                    </div>
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
