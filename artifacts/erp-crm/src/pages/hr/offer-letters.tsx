import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useListOfferLetters, useCreateOfferLetter, useListEmployees, useGetEmployee,
  useListCompanies,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Search, User } from "lucide-react";

const COMMISSION_DEFAULTS = {
  commissionTargetAmount: "200000",
  commissionCurrency: "AED",
  commissionBaseRatePct: "1",
  commissionBonusPerStepAmount: "1000",
  commissionBonusStepSize: "100000",
  commissionShortfallTier1Pct: "25",
  commissionShortfallTier1DeductionPct: "15",
  commissionShortfallTier2Pct: "50",
  commissionShortfallTier2DeductionPct: "35",
  commissionNotes: "",
};
const isSalesRole = (s: string | undefined | null): boolean => {
  const t = (s ?? "").toLowerCase();
  return /\bsales(man|person|woman|\s+executive)?\b/.test(t) || t.includes("salesman") || t.includes("sales executive") || t.includes("sales");
};

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
  commissionEnabled: false,
  ...COMMISSION_DEFAULTS,
};

export function OfferLettersList() {
  const [, setLocation] = useLocation();
  // Initial filter state mirrors URL query params so dashboard links such as
  // /hr/offer-letters?status=issued land on a pre-filtered view.
  const initialParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [status, setStatus] = useState<string>(initialParams.get("status") ?? "all");
  const [templateType, setTemplateType] = useState<string>(initialParams.get("templateType") ?? "all");
  const [companyFilter, setCompanyFilter] = useState<string>(initialParams.get("companyId") ?? "all");
  const [search, setSearch] = useState(initialParams.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const qc = useQueryClient();
  const { filterByCompany, activeCompanyId } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const primeBtnCls = isElite ? "bg-[#0D0D0D] hover:bg-[#8B0000]" : "bg-[#0f2d5a] hover:bg-[#1e6ab0]";
  const { data: offers, isLoading } = useListOfferLetters({ status: status === "all" ? undefined : status, templateType: templateType === "all" ? undefined : templateType });
  const { data: companies } = useListCompanies();
  const filtered = (filterByCompany(offers ?? []) as any[]).filter(o => {
    if (companyFilter !== "all" && String(o.companyId) !== companyFilter) return false;
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
    const num = (s: string) => (s === "" || s == null ? undefined : Number(s));
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
        commissionEnabled: form.commissionEnabled,
        ...(form.commissionEnabled ? {
          commissionTargetAmount: num(form.commissionTargetAmount),
          commissionCurrency: form.commissionCurrency || "AED",
          commissionBaseRatePct: num(form.commissionBaseRatePct),
          commissionBonusPerStepAmount: num(form.commissionBonusPerStepAmount),
          commissionBonusStepSize: num(form.commissionBonusStepSize),
          commissionShortfallTier1Pct: num(form.commissionShortfallTier1Pct),
          commissionShortfallTier1DeductionPct: num(form.commissionShortfallTier1DeductionPct),
          commissionShortfallTier2Pct: num(form.commissionShortfallTier2Pct),
          commissionShortfallTier2DeductionPct: num(form.commissionShortfallTier2DeductionPct),
          commissionNotes: form.commissionNotes || undefined,
        } : {}),
      } as any,
    });
  };

  // Auto-suggest the commission toggle when the designation looks like a sales role.
  // Only flips OFF→ON automatically; never disables a manually-enabled flag.
  useEffect(() => {
    if (!form.commissionEnabled && isSalesRole(form.designation)) {
      setForm(p => ({ ...p, commissionEnabled: true }));
    }
  }, [form.designation]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Offer Letters</h1>
          <p className="text-muted-foreground">Issue and track candidate offer letters.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm({ ...EMPTY_FORM }); }}>
          <DialogTrigger asChild><Button className={primeBtnCls} data-testid="button-new-offer"><Plus className="w-4 h-4 mr-2" />New Offer Letter</Button></DialogTrigger>
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

              <div className="col-span-2 mt-2 border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Salesman Commission</Label>
                    <p className="text-[11px] text-muted-foreground">Enable to attach a sales target, base rate, bonus and shortfall deductions to this letter.{isSalesRole(form.designation) && !form.commissionEnabled ? " Suggested for sales roles." : ""}</p>
                  </div>
                  <Switch checked={form.commissionEnabled} onCheckedChange={v => setForm(p => ({ ...p, commissionEnabled: v }))} data-testid="switch-commission-enabled" />
                </div>
                {form.commissionEnabled && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="space-y-1"><Label className="text-xs">Sales Target ({form.commissionCurrency || "AED"})</Label><Input type="number" value={form.commissionTargetAmount} onChange={e => setForm(p => ({ ...p, commissionTargetAmount: e.target.value }))} data-testid="input-commission-target" /></div>
                    <div className="space-y-1"><Label className="text-xs">Currency</Label><Input value={form.commissionCurrency} onChange={e => setForm(p => ({ ...p, commissionCurrency: e.target.value }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Base Commission Rate (%)</Label><Input type="number" step="0.01" value={form.commissionBaseRatePct} onChange={e => setForm(p => ({ ...p, commissionBaseRatePct: e.target.value }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Bonus per Step ({form.commissionCurrency || "AED"})</Label><Input type="number" value={form.commissionBonusPerStepAmount} onChange={e => setForm(p => ({ ...p, commissionBonusPerStepAmount: e.target.value }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Step Size (above target, {form.commissionCurrency || "AED"})</Label><Input type="number" value={form.commissionBonusStepSize} onChange={e => setForm(p => ({ ...p, commissionBonusStepSize: e.target.value }))} /></div>
                    <div className="hidden md:block" />
                    <div className="space-y-1"><Label className="text-xs">Tier 1 Shortfall (%)</Label><Input type="number" value={form.commissionShortfallTier1Pct} onChange={e => setForm(p => ({ ...p, commissionShortfallTier1Pct: e.target.value }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Tier 1 Salary Deduction (%)</Label><Input type="number" value={form.commissionShortfallTier1DeductionPct} onChange={e => setForm(p => ({ ...p, commissionShortfallTier1DeductionPct: e.target.value }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Tier 2 Achievement ≤ (%)</Label><Input type="number" value={form.commissionShortfallTier2Pct} onChange={e => setForm(p => ({ ...p, commissionShortfallTier2Pct: e.target.value }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Tier 2 Salary Deduction (%)</Label><Input type="number" value={form.commissionShortfallTier2DeductionPct} onChange={e => setForm(p => ({ ...p, commissionShortfallTier2DeductionPct: e.target.value }))} /></div>
                    <div className="space-y-1 col-span-2"><Label className="text-xs">Commission Notes (optional)</Label><Textarea rows={2} value={form.commissionNotes} onChange={e => setForm(p => ({ ...p, commissionNotes: e.target.value }))} /></div>
                  </div>
                )}
              </div>
            </div>
            <Button className={`mt-4 ${primeBtnCls}`} onClick={submit} disabled={!form.candidateName || !form.companyId || create.isPending} data-testid="button-create-offer">
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
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-48" data-testid="select-company-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {(companies ?? []).map((c: any) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.shortName ?? c.name}</SelectItem>
            ))}
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
              <TableHead>Issued</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow> :
            filtered.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No offer letters.</TableCell></TableRow> :
            filtered.map(o => (
              <TableRow key={o.id} className="cursor-pointer hover:bg-muted/40" data-testid={`row-offer-${o.id}`}>
                <TableCell className="font-mono text-xs"><Link href={`/hr/offer-letters/${o.id}`} className="text-primary hover:underline">{o.letterNumber}</Link><div className="text-[10px] text-muted-foreground">v{o.version}</div></TableCell>
                <TableCell className="font-medium"><Link href={`/hr/offer-letters/${o.id}`} className="hover:underline flex items-center gap-1"><FileText className="w-3 h-3" />{o.candidateName}</Link></TableCell>
                <TableCell>{o.designation || "-"}</TableCell>
                <TableCell>{o.companyName || `#${o.companyId}`}</TableCell>
                <TableCell><Badge variant="outline">{o.templateType}</Badge></TableCell>
                <TableCell>{o.joiningDate || "-"}</TableCell>
                <TableCell><Badge className={STATUS_TONE[o.status] ?? ""}>{o.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{o.issuedAt ? new Date(o.issuedAt).toLocaleDateString("en-AE") : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("en-AE")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
