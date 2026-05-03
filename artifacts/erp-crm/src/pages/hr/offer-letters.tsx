import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useListOfferLetters, useCreateOfferLetter, useListEmployees, useGetEmployee,
  getListOfferLettersQueryKey, getGetEmployeeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyField } from "@/components/CompanyField";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Plus, Search, User } from "lucide-react";

const STATUS_TONE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  issued: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const NEW_CANDIDATE = "__new_candidate__";

const EMPTY_FORM = {
  source: NEW_CANDIDATE as string,
  employeeId: "" as string,
  candidateName: "", companyId: "", templateType: "staff", workerType: "staff",
  designation: "", joiningDate: "", basicSalary: "", allowances: "",
  candidateNationality: "", candidatePassportNo: "", candidatePersonalEmail: "", candidatePersonalPhone: "",
};

export function OfferLettersList() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<string>("all");
  const [templateType, setTemplateType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const qc = useQueryClient();
  const { filterByCompany } = useActiveCompany();
  const { data: offers, isLoading } = useListOfferLetters({ status: status === "all" ? undefined : status, templateType: templateType === "all" ? undefined : templateType });
  const filtered = (filterByCompany(offers ?? []) as any[]).filter(o => {
    const s = search.toLowerCase();
    return !s || o.candidateName.toLowerCase().includes(s) || o.letterNumber.toLowerCase().includes(s);
  });
  const { data: employees } = useListEmployees({});
  const scopedEmployees = filterByCompany(employees ?? []) as any[];

  // Pull selected employee for prefill (only once a real employee id is chosen).
  const selectedEmpId = form.source !== NEW_CANDIDATE && form.source ? parseInt(form.source, 10) : undefined;
  const { data: selectedEmployee } = useGetEmployee(selectedEmpId!, {
    query: { queryKey: getGetEmployeeQueryKey(selectedEmpId!), enabled: !!selectedEmpId },
  });
  useEffect(() => {
    if (!selectedEmployee) return;
    const e: any = selectedEmployee;
    setForm(p => ({
      ...p,
      employeeId: String(e.id),
      candidateName: e.name ?? p.candidateName,
      companyId: e.companyId ? String(e.companyId) : p.companyId,
      designation: e.designation ?? p.designation,
      joiningDate: e.joiningDate ?? p.joiningDate,
      basicSalary: e.basicSalary != null ? String(e.basicSalary) : p.basicSalary,
      allowances: e.allowances != null ? String(e.allowances) : p.allowances,
      candidateNationality: e.nationality ?? p.candidateNationality,
      candidatePassportNo: e.passportNo ?? p.candidatePassportNo,
      candidatePersonalEmail: e.personalEmail ?? p.candidatePersonalEmail,
      candidatePersonalPhone: e.personalPhone ?? p.candidatePersonalPhone,
      templateType: e.type === "labor" || e.type === "labour" ? "labour" : "staff",
      workerType: e.type === "labor" || e.type === "labour" ? "labor" : "staff",
    }));
  }, [selectedEmployee]);

  // Auto-open via ?new=1 (and pre-select employee if employeeId param present)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setOpen(true);
      const eid = params.get("employeeId");
      if (eid) setForm(p => ({ ...p, source: eid }));
    }
  }, []);

  const create = useCreateOfferLetter({
    mutation: {
      onSuccess: (created: any) => {
        qc.invalidateQueries({ queryKey: getListOfferLettersQueryKey() });
        setOpen(false);
        setForm({ ...EMPTY_FORM });
        setLocation(`/hr/offer-letters/${created.id}`);
      },
    },
  });

  const submit = () => {
    create.mutate({
      data: {
        candidateName: form.candidateName,
        companyId: parseInt(form.companyId, 10),
        templateType: form.templateType,
        workerType: form.workerType,
        employeeId: form.employeeId ? parseInt(form.employeeId, 10) : undefined,
        designation: form.designation || undefined,
        joiningDate: form.joiningDate || undefined,
        basicSalary: form.basicSalary ? Number(form.basicSalary) : undefined,
        allowances: form.allowances ? Number(form.allowances) : undefined,
        candidateNationality: form.candidateNationality || undefined,
        candidatePassportNo: form.candidatePassportNo || undefined,
        candidatePersonalEmail: form.candidatePersonalEmail || undefined,
        candidatePersonalPhone: form.candidatePersonalPhone || undefined,
      } as any,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Offer Letters</h1>
          <p className="text-muted-foreground">Issue and track candidate offer letters.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm({ ...EMPTY_FORM }); }}>
          <DialogTrigger asChild><Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" data-testid="button-new-offer"><Plus className="w-4 h-4 mr-2" />New Offer Letter</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Offer Letter</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1 col-span-2">
                <Label className="flex items-center gap-1"><User className="w-3 h-3" />Candidate Source *</Label>
                <Select value={form.source} onValueChange={v => {
                  if (v === NEW_CANDIDATE) {
                    // Reset to a fresh new-candidate state
                    setForm({ ...EMPTY_FORM, source: NEW_CANDIDATE });
                  } else {
                    setForm(p => ({ ...p, source: v, employeeId: v }));
                  }
                }}>
                  <SelectTrigger data-testid="select-candidate-source"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NEW_CANDIDATE}>+ New candidate (manual entry)</SelectItem>
                    {scopedEmployees.map(e => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.name} · {e.employeeId}{e.designation ? ` · ${e.designation}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.source !== NEW_CANDIDATE && form.employeeId && (
                  <p className="text-[11px] text-muted-foreground">Pre-filled from employee #{form.employeeId}. Edit any field below before issuing.</p>
                )}
              </div>
              <div className="space-y-1 col-span-2"><Label>Candidate Name *</Label><Input value={form.candidateName} onChange={e => setForm(p => ({ ...p, candidateName: e.target.value }))} data-testid="input-candidate-name" /></div>
              <div className="space-y-1"><Label>Issuing Company *</Label><CompanyField value={form.companyId} onChange={v => setForm(p => ({ ...p, companyId: v }))} /></div>
              <div className="space-y-1"><Label>Template *</Label>
                <Select value={form.templateType} onValueChange={v => setForm(p => ({ ...p, templateType: v, workerType: v === "labour" ? "labor" : "staff" }))}>
                  <SelectTrigger data-testid="select-template-type"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="staff">Staff (08:00 AM – 06:00 PM)</SelectItem><SelectItem value="labour">Labour (07:00 AM – 07:00 PM, 9h+2h breaks)</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Designation</Label><Input value={form.designation} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Joining Date</Label><Input type="date" value={form.joiningDate} onChange={e => setForm(p => ({ ...p, joiningDate: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Basic Salary (AED)</Label><Input type="number" value={form.basicSalary} onChange={e => setForm(p => ({ ...p, basicSalary: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Allowances (AED)</Label><Input type="number" value={form.allowances} onChange={e => setForm(p => ({ ...p, allowances: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Nationality</Label><Input value={form.candidateNationality} onChange={e => setForm(p => ({ ...p, candidateNationality: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Passport No.</Label><Input value={form.candidatePassportNo} onChange={e => setForm(p => ({ ...p, candidatePassportNo: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Personal Email</Label><Input value={form.candidatePersonalEmail} onChange={e => setForm(p => ({ ...p, candidatePersonalEmail: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Personal Phone</Label><Input value={form.candidatePersonalPhone} onChange={e => setForm(p => ({ ...p, candidatePersonalPhone: e.target.value }))} /></div>
            </div>
            <Button className="mt-4 bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={submit} disabled={!form.candidateName || !form.companyId || create.isPending} data-testid="button-create-offer">
              {create.isPending ? "Creating…" : "Create Draft"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or number…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={templateType} onValueChange={setTemplateType}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Templates</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="labour">Labour</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Letter #</TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Joining</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow> :
            filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No offer letters.</TableCell></TableRow> :
            filtered.map(o => (
              <TableRow key={o.id} className="cursor-pointer hover:bg-muted/40" data-testid={`row-offer-${o.id}`}>
                <TableCell className="font-mono text-xs"><Link href={`/hr/offer-letters/${o.id}`} className="text-primary hover:underline">{o.letterNumber}</Link><div className="text-[10px] text-muted-foreground">v{o.version}</div></TableCell>
                <TableCell className="font-medium"><Link href={`/hr/offer-letters/${o.id}`} className="hover:underline flex items-center gap-1"><FileText className="w-3 h-3" />{o.candidateName}</Link></TableCell>
                <TableCell>{o.designation || "-"}</TableCell>
                <TableCell>{o.companyName || `#${o.companyId}`}</TableCell>
                <TableCell><Badge variant="outline">{o.templateType}</Badge></TableCell>
                <TableCell>{o.joiningDate || "-"}</TableCell>
                <TableCell><Badge className={STATUS_TONE[o.status] ?? ""}>{o.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("en-AE")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
