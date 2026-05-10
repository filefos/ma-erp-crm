import { useEffect, useRef, useState } from "react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Link, useLocation } from "wouter";
import {
  useGetOfferLetter, useUpdateOfferLetter, useSetOfferLetterStatus,
  useReissueOfferLetter, useConvertOfferLetterToEmployee, useListCompanies,
  useListOfferLetterAttachments, useUploadOfferLetterAttachment, useDeleteOfferLetterAttachment,
  getGetOfferLetterQueryKey, getListOfferLettersQueryKey, getListOfferLetterAttachmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, Pencil, Save, X, Send, FileDown, Printer, RefreshCcw, UserPlus, CheckCircle2, XCircle,
  Paperclip, Upload, Trash2, Download, Loader2,
} from "lucide-react";
import { OfferLetterTemplate } from "@/components/hr/offer-letter-template";
import { captureElementToPdfBase64 } from "@/lib/print-to-pdf";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { authHeaders } from "@/lib/ai-client";

const COMMISSION_DEFAULTS = {
  commissionTargetAmount: 200000,
  commissionCurrency: "AED",
  commissionBaseRatePct: 1,
  commissionBonusPerStepAmount: 1000,
  commissionBonusStepSize: 100000,
  commissionShortfallTier1Pct: 25,
  commissionShortfallTier1DeductionPct: 15,
  commissionShortfallTier2Pct: 50,
  commissionShortfallTier2DeductionPct: 35,
};

interface Props { id: string }

const STATUS_TONE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  issued: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export function OfferLetterDetail({ id }: Props) {
  const { activeCompanyId } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const primeBtnCls = isElite ? "bg-[#0D0D0D] hover:bg-[#8B0000]" : "bg-[#0f2d5a] hover:bg-[#1e6ab0]";
  const oid = parseInt(id, 10);
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { can, isSuperAdmin } = usePermissions();
  const { user: authUser } = useAuth();
  const [downloadingAtt, setDownloadingAtt] = useState<number | null>(null);

  async function authedFetch(url: string): Promise<string> {
    const r = await fetch(url, { headers: authHeaders() });
    if (!r.ok) throw new Error(`Failed to fetch file: ${r.status}`);
    const blob = await r.blob();
    return URL.createObjectURL(blob);
  }

  async function downloadAuthed(url: string, filename: string) {
    try {
      const objectUrl = await authedFetch(url);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch {
      toast({ title: "Download failed", description: "Could not download the file. Please try again.", variant: "destructive" });
    }
  }

  // Mirrors the server-side isHrOrAdmin() check: shows upload/delete controls
  // only to users who will actually be authorized server-side, preventing
  // confusing 403s for users who have offer_letters:edit but are not HR/admin.
  const isHrOrAdmin = isSuperAdmin
    || (authUser as any)?.permissionLevel === "company_admin"
    || ((authUser as any)?.role ?? "").toLowerCase().includes("hr");
  const { data: offer, isLoading } = useGetOfferLetter(oid, { query: { queryKey: getGetOfferLetterQueryKey(oid), enabled: !!oid } });
  const { data: companies } = useListCompanies();
  // Prefer the snapshot stored on the offer record (locked-in at issue time so
  // renaming a company later cannot retroactively change a historical letter).
  // Fall back to a live company-id lookup only for older rows that pre-date the
  // snapshot columns.
  const resolvedLetterhead: "prime" | "elite" | undefined = (() => {
    const snap = (offer as any)?.letterheadBrand;
    if (snap === "prime" || snap === "elite") return snap;
    if (!offer || !companies) return undefined;
    const c = (companies as any[]).find(x => x.id === offer.companyId);
    if (!c) return undefined;
    const blob = `${c.shortName ?? ""} ${c.name ?? ""}`.toLowerCase();
    if (blob.includes("elite")) return "elite";
    if (blob.includes("prime")) return "prime";
    return undefined;
  })();
  const snapshotLegalName: string | undefined = (offer as any)?.companyLegalName ?? undefined;
  const update = useUpdateOfferLetter({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getGetOfferLetterQueryKey(oid) }) } });
  const setStatus = useSetOfferLetterStatus({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getGetOfferLetterQueryKey(oid) }) } });
  const reissue = useReissueOfferLetter({
    mutation: {
      onSuccess: (created: any) => {
        qc.invalidateQueries({ queryKey: getListOfferLettersQueryKey() });
        setLocation(`/hr/offer-letters/${created.id}`);
      },
    },
  });
  const convert = useConvertOfferLetterToEmployee({
    mutation: {
      onSuccess: (emp: any) => {
        qc.invalidateQueries({ queryKey: getGetOfferLetterQueryKey(oid) });
        setLocation(`/hr/employees/${emp.id}`);
      },
    },
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>({});
  useEffect(() => {
    if (offer && !editing) {
      setDraft({
        candidateName: offer.candidateName ?? "",
        candidateNationality: (offer as any).candidateNationality ?? "",
        candidatePassportNo: (offer as any).candidatePassportNo ?? "",
        candidatePersonalEmail: (offer as any).candidatePersonalEmail ?? "",
        candidatePersonalPhone: (offer as any).candidatePersonalPhone ?? "",
        designation: offer.designation ?? "",
        joiningDate: offer.joiningDate ?? "",
        basicSalary: (offer as any).basicSalary ?? "",
        allowances: (offer as any).allowances ?? "",
        templateType: offer.templateType ?? "staff",
        workerType: (offer as any).workerType ?? "staff",
        notes: offer.notes ?? "",
        commissionEnabled: !!offer.commissionEnabled,
        commissionTargetAmount: offer.commissionTargetAmount ?? "",
        commissionCurrency: offer.commissionCurrency ?? "AED",
        commissionBaseRatePct: offer.commissionBaseRatePct ?? "",
        commissionBonusPerStepAmount: offer.commissionBonusPerStepAmount ?? "",
        commissionBonusStepSize: offer.commissionBonusStepSize ?? "",
        commissionShortfallTier1Pct: offer.commissionShortfallTier1Pct ?? "",
        commissionShortfallTier1DeductionPct: offer.commissionShortfallTier1DeductionPct ?? "",
        commissionShortfallTier2Pct: offer.commissionShortfallTier2Pct ?? "",
        commissionShortfallTier2DeductionPct: offer.commissionShortfallTier2DeductionPct ?? "",
        commissionNotes: offer.commissionNotes ?? "",
      });
    }
  }, [offer, editing]);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [attError, setAttError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const attachmentsQueryKey = getListOfferLetterAttachmentsQueryKey(oid);
  const { data: attachmentsData, isLoading: attLoading } = useListOfferLetterAttachments(oid, {
    query: { queryKey: attachmentsQueryKey, enabled: !!oid },
  });
  const attachments = (attachmentsData ?? []) as any[];
  const uploadAttachment = useUploadOfferLetterAttachment({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: attachmentsQueryKey }) },
  });
  const deleteAttachment = useDeleteOfferLetterAttachment({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: attachmentsQueryKey }) },
  });

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setAttError(null);
    let successCount = 0;
    try {
      for (const f of Array.from(files)) {
        if (f.size > 8 * 1024 * 1024) {
          const msg = `"${f.name}" exceeds 8 MB limit`;
          setAttError(msg);
          toast({ title: "File too large", description: msg, variant: "destructive" });
          continue;
        }
        await uploadAttachment.mutateAsync({ id: oid, data: { file: f as any } });
        successCount++;
      }
      if (successCount > 0) {
        toast({ title: successCount === 1 ? "File uploaded" : `${successCount} files uploaded`, description: "Documents saved successfully." });
      }
    } catch (e: any) {
      const msg = e?.message ?? "Upload failed";
      setAttError(msg);
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // NOTE: All hook calls must happen before the early returns below to satisfy
  // the rules of hooks (React throws "Rendered more hooks than during the
  // previous render" otherwise — this regressed when companyLogoUrl made the
  // companies query loading state observable to this component).

  // Auto-suggest the commission toggle when designation looks like a sales role.
  // Mirrors the create dialog: only flips OFF -> ON, never disables. Guards on
  // offer presence + edit status internally so it can sit above the early
  // returns.
  const canEditAuto = !!offer && !(offer as any).convertedEmployeeId;
  useEffect(() => {
    if (!offer || !editing || !canEditAuto) return;
    const t = String(draft.designation ?? "").toLowerCase();
    const looksLikeSales = /\bsales(man|person|woman|\s+executive)?\b/.test(t) || t.includes("sales");
    if (looksLikeSales && !draft.commissionEnabled) {
      setDraft((p: any) => ({
        ...p,
        commissionEnabled: true,
        ...Object.fromEntries(Object.entries(COMMISSION_DEFAULTS).map(([k, v]) =>
          [k, p[k] === "" || p[k] == null ? v : p[k]])),
      }));
    }
  }, [draft.designation, editing, canEditAuto, draft.commissionEnabled, offer]);

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;
  if (!offer) return <div className="p-8 text-muted-foreground">Offer letter not found.</div>;

  const isDraft = offer.status === "draft";
  const isIssued = offer.status === "issued";
  const isAccepted = offer.status === "accepted";
  // Editing is allowed in any status until the offer is converted to an
  // employee record. Status-changing buttons (Issue / Accept / Reject) keep
  // their own status-specific gating below.
  const canEdit = !(offer as any).convertedEmployeeId;
  // Live-resolved company logo URL (data: URL or http(s) link stored on the
  // companies row). Falls back to the brand-based image inside the template
  // when not provided so historical letters still render.
  const companyLogoUrl: string | undefined = (() => {
    if (!companies) return undefined;
    const c = (companies as any[]).find(x => x.id === offer.companyId);
    return c?.logo || undefined;
  })();

  const save = () => {
    const patch: any = { ...draft };
    if (patch.basicSalary === "") delete patch.basicSalary; else patch.basicSalary = Number(patch.basicSalary);
    if (patch.allowances === "") delete patch.allowances; else patch.allowances = Number(patch.allowances);
    const numKeys = [
      "commissionTargetAmount","commissionBaseRatePct","commissionBonusPerStepAmount","commissionBonusStepSize",
      "commissionShortfallTier1Pct","commissionShortfallTier1DeductionPct",
      "commissionShortfallTier2Pct","commissionShortfallTier2DeductionPct",
    ];
    if (!patch.commissionEnabled) {
      // Persist the disabled flag but null out numeric fields so we don't write garbage.
      for (const k of numKeys) patch[k] = null;
      patch.commissionNotes = null;
    } else {
      for (const k of numKeys) {
        patch[k] = patch[k] === "" || patch[k] == null ? null : Number(patch[k]);
      }
    }
    update.mutate({ id: oid, data: { ...patch, companyId: offer.companyId } as any });
    setEditing(false);
  };

  const enableCommissionWithDefaults = () => {
    setDraft((p: any) => ({
      ...p,
      commissionEnabled: true,
      ...Object.fromEntries(Object.entries(COMMISSION_DEFAULTS).map(([k, v]) =>
        [k, p[k] === "" || p[k] == null ? v : p[k]])),
    }));
  };

  const downloadPdf = async () => {
    if (!previewRef.current) return;
    setDownloading(true);
    try {
      const co = (companies as any[] | undefined)?.find((x: any) => x.id === offer.companyId);
      const signatureUrl = (authUser as any)?.signatureUrl || undefined;
      const stampUrl = co?.stamp || undefined;
      const stampWidthPct = co?.stampWidthPct ?? undefined;
      const stampMarginPct = co?.stampMarginPct ?? undefined;
      const { base64, filename } = await captureElementToPdfBase64(previewRef.current, `${offer.letterNumber}-${offer.candidateName.replace(/\s+/g, "_")}`, { signatureUrl, stampUrl, stampWidthPct, stampMarginPct });
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${base64}`;
      link.download = filename;
      link.click();
    } finally { setDownloading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild><Link href="/hr/offer-letters"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-offer-title">{offer.letterNumber} <span className="text-base text-muted-foreground font-normal">v{offer.version}</span></h1>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {offer.candidateName} · {(offer as any).companyName ?? `Company #${offer.companyId}`}
            <Badge className={STATUS_TONE[offer.status] ?? ""}>{offer.status}</Badge>
            {(offer as any).parentOfferId && <Badge variant="outline" className="text-[10px]">re-issue of #{(offer as any).parentOfferId}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={downloadPdf} disabled={downloading} data-testid="button-download-pdf">
            <FileDown className="w-4 h-4 mr-1" />{downloading ? "Generating…" : "Download PDF"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print-offer">
            <Printer className="w-4 h-4 mr-1" />Print
          </Button>
          {canEdit && !editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid="button-edit-offer"><Pencil className="w-4 h-4 mr-1" />Edit</Button>}
          {canEdit && editing && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}><X className="w-4 h-4 mr-1" />Cancel</Button>
              <Button size="sm" onClick={save} className={primeBtnCls} data-testid="button-save-offer"><Save className="w-4 h-4 mr-1" />Save</Button>
            </>
          )}
          {isDraft && (
            <Button size="sm" className={primeBtnCls} onClick={() => setStatus.mutate({ id: oid, data: { status: "issued" } })} data-testid="button-issue-offer">
              <Send className="w-4 h-4 mr-1" />Issue
            </Button>
          )}
          {isIssued && (
            <>
              <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={() => setStatus.mutate({ id: oid, data: { status: "accepted" } })} data-testid="button-accept-offer">
                <CheckCircle2 className="w-4 h-4 mr-1" />Mark Accepted
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setStatus.mutate({ id: oid, data: { status: "rejected", rejectionReason: rejectionReason || undefined } })} data-testid="button-reject-offer">
                <XCircle className="w-4 h-4 mr-1" />Reject
              </Button>
            </>
          )}
          {(isIssued || offer.status === "rejected") && (
            <Button size="sm" variant="outline" onClick={() => reissue.mutate({ id: oid })} data-testid="button-reissue-offer">
              <RefreshCcw className="w-4 h-4 mr-1" />Re-issue
            </Button>
          )}
          {isAccepted && !(offer as any).convertedEmployeeId && (
            <Button size="sm" className={primeBtnCls} onClick={() => convert.mutate({ id: oid })} data-testid="button-convert-employee">
              <UserPlus className="w-4 h-4 mr-1" />Convert to Employee
            </Button>
          )}
          {(offer as any).convertedEmployeeId && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/hr/employees/${(offer as any).convertedEmployeeId}`}>View Employee →</Link>
            </Button>
          )}
        </div>
      </div>

      {isIssued && (
        <Card>
          <CardContent className="py-3">
            <Label className="text-xs">Rejection reason (optional, only used if rejecting)</Label>
            <Input value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="e.g. Candidate accepted another offer" className="mt-1" />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Edit pane */}
        <Card>
          <CardHeader><CardTitle>{isDraft ? "Draft Fields" : "Letter Details"}{canEdit && !isDraft && <span className="ml-2 text-xs text-muted-foreground font-normal">(editable)</span>}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <FieldRow label="Candidate Name" k="candidateName" v={offer} editing={editing && canEdit} draft={draft} setDraft={setDraft} className="col-span-2" />
            <FieldRow label="Designation" k="designation" v={offer} editing={editing && canEdit} draft={draft} setDraft={setDraft} />
            <FieldRow label="Joining Date" k="joiningDate" type="date" v={offer} editing={editing && canEdit} draft={draft} setDraft={setDraft} />
            <FieldRow label="Basic Salary (AED)" k="basicSalary" type="number" v={offer} editing={editing && canEdit} draft={draft} setDraft={setDraft} />
            <FieldRow label="Allowances (AED)" k="allowances" type="number" v={offer} editing={editing && canEdit} draft={draft} setDraft={setDraft} />
            <FieldRow label="Nationality" k="candidateNationality" v={offer} editing={editing && canEdit} draft={draft} setDraft={setDraft} />
            <FieldRow label="Passport No." k="candidatePassportNo" v={offer} editing={editing && canEdit} draft={draft} setDraft={setDraft} />
            <FieldRow label="Personal Email" k="candidatePersonalEmail" v={offer} editing={editing && canEdit} draft={draft} setDraft={setDraft} />
            <FieldRow label="Personal Phone" k="candidatePersonalPhone" v={offer} editing={editing && canEdit} draft={draft} setDraft={setDraft} />
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">Template</Label>
              {editing && canEdit ? (
                <Select value={draft.templateType} onValueChange={v => setDraft((p: any) => ({ ...p, templateType: v, workerType: v === "labour" ? "labor" : "staff" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff (08:00–18:00)</SelectItem>
                    <SelectItem value="labour">Labour (07:00–19:00, 9h+2h break)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm">{offer.templateType}</div>
              )}
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">Additional Notes</Label>
              {editing && canEdit ? (
                <Textarea rows={4} value={draft.notes} onChange={e => setDraft((p: any) => ({ ...p, notes: e.target.value }))} />
              ) : (
                <div className="text-sm whitespace-pre-wrap">{offer.notes || <span className="text-muted-foreground">—</span>}</div>
              )}
            </div>

            <div className="col-span-2 mt-2 border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Salesman Commission</Label>
                  <p className="text-[11px] text-muted-foreground">Sales target, base rate, per-step bonus and shortfall salary deductions printed on the letter.</p>
                </div>
                {editing && canEdit ? (
                  <Switch
                    checked={!!draft.commissionEnabled}
                    onCheckedChange={(v) => v ? enableCommissionWithDefaults() : setDraft((p: any) => ({ ...p, commissionEnabled: false }))}
                    data-testid="switch-detail-commission-enabled"
                  />
                ) : (
                  <Badge variant="outline">{offer.commissionEnabled ? "Enabled" : "Disabled"}</Badge>
                )}
              </div>
              {editing && canEdit && draft.commissionEnabled && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <CField label={`Sales Target (${draft.commissionCurrency || "AED"})`} k="commissionTargetAmount" type="number" draft={draft} setDraft={setDraft} />
                  <CField label="Currency" k="commissionCurrency" draft={draft} setDraft={setDraft} />
                  <CField label="Base Commission Rate (%)" k="commissionBaseRatePct" type="number" draft={draft} setDraft={setDraft} />
                  <CField label={`Bonus per Step (${draft.commissionCurrency || "AED"})`} k="commissionBonusPerStepAmount" type="number" draft={draft} setDraft={setDraft} />
                  <CField label={`Step Size above target (${draft.commissionCurrency || "AED"})`} k="commissionBonusStepSize" type="number" draft={draft} setDraft={setDraft} />
                  <div />
                  <CField label="Tier 1 Shortfall (%)" k="commissionShortfallTier1Pct" type="number" draft={draft} setDraft={setDraft} />
                  <CField label="Tier 1 Salary Deduction (%)" k="commissionShortfallTier1DeductionPct" type="number" draft={draft} setDraft={setDraft} />
                  <CField label="Tier 2 Achievement ≤ (%)" k="commissionShortfallTier2Pct" type="number" draft={draft} setDraft={setDraft} />
                  <CField label="Tier 2 Salary Deduction (%)" k="commissionShortfallTier2DeductionPct" type="number" draft={draft} setDraft={setDraft} />
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Commission Notes</Label>
                    <Textarea rows={2} value={draft.commissionNotes ?? ""} onChange={e => setDraft((p: any) => ({ ...p, commissionNotes: e.target.value }))} />
                  </div>
                </div>
              )}
              {!(editing && canEdit) && offer.commissionEnabled && (
                <div className="text-xs text-muted-foreground mt-2 grid grid-cols-2 gap-1">
                  <div>Target: {offer.commissionCurrency ?? "AED"} {Number(offer.commissionTargetAmount ?? 0).toLocaleString()}</div>
                  <div>Base rate: {offer.commissionBaseRatePct ?? 0}%</div>
                  <div>Bonus: {offer.commissionCurrency ?? "AED"} {Number(offer.commissionBonusPerStepAmount ?? 0).toLocaleString()} / {offer.commissionCurrency ?? "AED"} {Number(offer.commissionBonusStepSize ?? 0).toLocaleString()} above target</div>
                  <div>Shortfall: {offer.commissionShortfallTier1DeductionPct ?? 0}% @ {offer.commissionShortfallTier1Pct ?? 0}% short, {offer.commissionShortfallTier2DeductionPct ?? 0}% @ ≤{offer.commissionShortfallTier2Pct ?? 0}% achievement</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview pane */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Letterhead Preview</CardTitle>
            <span className="text-xs text-muted-foreground">A4 · what gets emailed / printed</span>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto bg-muted/30 p-2" style={{ maxHeight: 700 }}>
              <div style={{ transform: "scale(0.6)", transformOrigin: "top left", width: "794px" }}>
                <OfferLetterTemplate
                  doc={{
                    letterNumber: offer.letterNumber,
                    candidateName: editing && canEdit ? (draft.candidateName || offer.candidateName) : offer.candidateName,
                    candidateNationality: editing && canEdit ? draft.candidateNationality : (offer as any).candidateNationality,
                    candidatePassportNo: editing && canEdit ? draft.candidatePassportNo : (offer as any).candidatePassportNo,
                    designation: editing && canEdit ? draft.designation : offer.designation,
                    joiningDate: editing && canEdit ? draft.joiningDate : offer.joiningDate,
                    basicSalary: editing && canEdit ? Number(draft.basicSalary || 0) : (offer as any).basicSalary,
                    allowances: editing && canEdit ? Number(draft.allowances || 0) : (offer as any).allowances,
                    templateType: editing && canEdit ? draft.templateType : offer.templateType,
                    workerType: editing && canEdit ? draft.workerType : (offer as any).workerType,
                    companyName: snapshotLegalName ?? (offer as any).companyName,
                    companyId: offer.companyId,
                    letterhead: resolvedLetterhead,
                    companyLogoUrl,
                    issuedAt: offer.issuedAt,
                    notes: editing && canEdit ? draft.notes : offer.notes,
                    commissionEnabled: editing && canEdit ? !!draft.commissionEnabled : !!offer.commissionEnabled,
                    commissionTargetAmount: editing && canEdit ? Number(draft.commissionTargetAmount || 0) : offer.commissionTargetAmount,
                    commissionCurrency: editing && canEdit ? draft.commissionCurrency : offer.commissionCurrency,
                    commissionBaseRatePct: editing && canEdit ? Number(draft.commissionBaseRatePct || 0) : offer.commissionBaseRatePct,
                    commissionBonusPerStepAmount: editing && canEdit ? Number(draft.commissionBonusPerStepAmount || 0) : offer.commissionBonusPerStepAmount,
                    commissionBonusStepSize: editing && canEdit ? Number(draft.commissionBonusStepSize || 0) : offer.commissionBonusStepSize,
                    commissionShortfallTier1Pct: editing && canEdit ? Number(draft.commissionShortfallTier1Pct || 0) : offer.commissionShortfallTier1Pct,
                    commissionShortfallTier1DeductionPct: editing && canEdit ? Number(draft.commissionShortfallTier1DeductionPct || 0) : offer.commissionShortfallTier1DeductionPct,
                    commissionShortfallTier2Pct: editing && canEdit ? Number(draft.commissionShortfallTier2Pct || 0) : offer.commissionShortfallTier2Pct,
                    commissionShortfallTier2DeductionPct: editing && canEdit ? Number(draft.commissionShortfallTier2DeductionPct || 0) : offer.commissionShortfallTier2DeductionPct,
                    commissionNotes: editing && canEdit ? draft.commissionNotes : offer.commissionNotes,
                  }}
                />
              </div>
            </div>
            {/*
              Off-screen, untransformed full-size copy used as the source for
              PDF capture. html2canvas-pro mis-measures text widths when its
              ancestor uses `transform: scale(...)`, which caused horizontal
              text overlap in the exported PDF. Rendering an unscaled clone
              here and capturing from `previewRef` instead fixes that without
              affecting the visible scaled preview above.
            */}
            <div aria-hidden="true" style={{ position: "fixed", left: "-10000px", top: 0, width: "794px", pointerEvents: "none", zIndex: -1 }}>
              <OfferLetterTemplate
                ref={previewRef}
                doc={{
                  letterNumber: offer.letterNumber,
                  candidateName: editing && canEdit ? (draft.candidateName || offer.candidateName) : offer.candidateName,
                  candidateNationality: editing && canEdit ? draft.candidateNationality : (offer as any).candidateNationality,
                  candidatePassportNo: editing && canEdit ? draft.candidatePassportNo : (offer as any).candidatePassportNo,
                  designation: editing && canEdit ? draft.designation : offer.designation,
                  joiningDate: editing && canEdit ? draft.joiningDate : offer.joiningDate,
                  basicSalary: editing && canEdit ? Number(draft.basicSalary || 0) : (offer as any).basicSalary,
                  allowances: editing && canEdit ? Number(draft.allowances || 0) : (offer as any).allowances,
                  templateType: editing && canEdit ? draft.templateType : offer.templateType,
                  workerType: editing && canEdit ? draft.workerType : (offer as any).workerType,
                  companyName: snapshotLegalName ?? (offer as any).companyName,
                  companyId: offer.companyId,
                  letterhead: resolvedLetterhead,
                  companyLogoUrl,
                  issuedAt: offer.issuedAt,
                  notes: editing && canEdit ? draft.notes : offer.notes,
                  commissionEnabled: editing && canEdit ? !!draft.commissionEnabled : !!offer.commissionEnabled,
                  commissionTargetAmount: editing && canEdit ? Number(draft.commissionTargetAmount || 0) : offer.commissionTargetAmount,
                  commissionCurrency: editing && canEdit ? draft.commissionCurrency : offer.commissionCurrency,
                  commissionBaseRatePct: editing && canEdit ? Number(draft.commissionBaseRatePct || 0) : offer.commissionBaseRatePct,
                  commissionBonusPerStepAmount: editing && canEdit ? Number(draft.commissionBonusPerStepAmount || 0) : offer.commissionBonusPerStepAmount,
                  commissionBonusStepSize: editing && canEdit ? Number(draft.commissionBonusStepSize || 0) : offer.commissionBonusStepSize,
                  commissionShortfallTier1Pct: editing && canEdit ? Number(draft.commissionShortfallTier1Pct || 0) : offer.commissionShortfallTier1Pct,
                  commissionShortfallTier1DeductionPct: editing && canEdit ? Number(draft.commissionShortfallTier1DeductionPct || 0) : offer.commissionShortfallTier1DeductionPct,
                  commissionShortfallTier2Pct: editing && canEdit ? Number(draft.commissionShortfallTier2Pct || 0) : offer.commissionShortfallTier2Pct,
                  commissionShortfallTier2DeductionPct: editing && canEdit ? Number(draft.commissionShortfallTier2DeductionPct || 0) : offer.commissionShortfallTier2DeductionPct,
                  commissionNotes: editing && canEdit ? draft.commissionNotes : offer.commissionNotes,
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Academic / Supporting Documents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="w-4 h-4" /> Academic &amp; Supporting Documents
          </CardTitle>
          {(canEdit && can("offer_letters", "canEdit") && isHrOrAdmin) && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.docx"
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
                data-testid="input-offer-attachment-file"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                data-testid="button-upload-offer-attachment"
              >
                <Upload className="w-4 h-4 mr-1" />{uploading ? "Uploading…" : "Upload"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {attError && <div className="text-xs text-red-600 mb-2" data-testid="text-attachment-error">{attError}</div>}
          {attLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : attachments.length === 0 ? (
            <div className="text-sm text-muted-foreground">No documents uploaded yet. Accepted: PDF, JPG, PNG, DOCX (max 8&nbsp;MB each).</div>
          ) : (
            <ul className="divide-y rounded border">
              {attachments.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2" data-testid={`row-attachment-${a.id}`}>
                  <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" title={a.fileName}>{a.fileName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.contentType || "file"} · {fmtBytes(a.sizeBytes)} · {new Date(a.uploadedAt).toLocaleString()}
                      {a.uploadedByName ? <> · uploaded by {a.uploadedByName}</> : null}
                    </div>
                  </div>
                  {a.signedUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={downloadingAtt === a.id}
                      data-testid={`button-download-attachment-${a.id}`}
                      onClick={async () => {
                        setDownloadingAtt(a.id);
                        try {
                          await downloadAuthed(a.signedUrl!, a.fileName);
                        } finally {
                          setDownloadingAtt(null);
                        }
                      }}
                    >
                      {downloadingAtt === a.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Download className="w-4 h-4" />}
                    </Button>
                  )}
                  {(canEdit && can("offer_letters", "canEdit") && isHrOrAdmin) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm(`Delete "${a.fileName}"?`)) return;
                        try {
                          await deleteAttachment.mutateAsync({ id: oid, attId: a.id });
                          toast({ title: "File deleted", description: `"${a.fileName}" removed.` });
                        } catch (e: any) {
                          const msg = e?.message ?? "Delete failed";
                          setAttError(msg);
                          toast({ title: "Delete failed", description: msg, variant: "destructive" });
                        }
                      }}
                      data-testid={`button-delete-attachment-${a.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function fmtBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function CField({ label, k, draft, setDraft, type = "text" }: { label: string; k: string; draft: any; setDraft: (fn: any) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={draft[k] ?? ""} onChange={e => setDraft((p: any) => ({ ...p, [k]: e.target.value }))} data-testid={`input-${k}`} />
    </div>
  );
}

function FieldRow({
  label, v, k, editing, draft, setDraft, type = "text", className = "",
}: {
  label: string; v: any; k: string; editing: boolean; draft: any; setDraft: (fn: any) => void; type?: string; className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editing
        ? <Input type={type} value={draft[k] ?? ""} onChange={e => setDraft((p: any) => ({ ...p, [k]: e.target.value }))} data-testid={`input-${k}`} />
        : <div className="text-sm">{v?.[k] || <span className="text-muted-foreground">—</span>}</div>}
    </div>
  );
}
