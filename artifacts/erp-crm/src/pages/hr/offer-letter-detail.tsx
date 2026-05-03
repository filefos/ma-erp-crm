import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetOfferLetter, useUpdateOfferLetter, useSetOfferLetterStatus,
  useReissueOfferLetter, useConvertOfferLetterToEmployee, useListCompanies,
  getGetOfferLetterQueryKey, getListOfferLettersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Pencil, Save, X, Send, FileDown, RefreshCcw, UserPlus, CheckCircle2, XCircle,
} from "lucide-react";
import { OfferLetterTemplate } from "@/components/hr/offer-letter-template";
import { captureElementToPdfBase64 } from "@/lib/print-to-pdf";

interface Props { id: string }

const STATUS_TONE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  issued: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export function OfferLetterDetail({ id }: Props) {
  const oid = parseInt(id, 10);
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
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
      });
    }
  }, [offer, editing]);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [downloading, setDownloading] = useState(false);

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;
  if (!offer) return <div className="p-8 text-muted-foreground">Offer letter not found.</div>;

  const isDraft = offer.status === "draft";
  const isIssued = offer.status === "issued";
  const isAccepted = offer.status === "accepted";

  const save = () => {
    const patch: any = { ...draft };
    if (patch.basicSalary === "") delete patch.basicSalary; else patch.basicSalary = Number(patch.basicSalary);
    if (patch.allowances === "") delete patch.allowances; else patch.allowances = Number(patch.allowances);
    update.mutate({ id: oid, data: { ...patch, companyId: offer.companyId } as any });
    setEditing(false);
  };

  const downloadPdf = async () => {
    if (!previewRef.current) return;
    setDownloading(true);
    try {
      const { base64, filename } = await captureElementToPdfBase64(previewRef.current, `${offer.letterNumber}-${offer.candidateName.replace(/\s+/g, "_")}`);
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
          {isDraft && !editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid="button-edit-offer"><Pencil className="w-4 h-4 mr-1" />Edit</Button>}
          {isDraft && editing && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}><X className="w-4 h-4 mr-1" />Cancel</Button>
              <Button size="sm" onClick={save} className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" data-testid="button-save-offer"><Save className="w-4 h-4 mr-1" />Save Draft</Button>
            </>
          )}
          {isDraft && (
            <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={() => setStatus.mutate({ id: oid, data: { status: "issued" } })} data-testid="button-issue-offer">
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
            <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={() => convert.mutate({ id: oid })} data-testid="button-convert-employee">
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
          <CardHeader><CardTitle>{isDraft ? "Draft Fields" : "Letter Details"}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <FieldRow label="Candidate Name" k="candidateName" v={offer} editing={editing && isDraft} draft={draft} setDraft={setDraft} className="col-span-2" />
            <FieldRow label="Designation" k="designation" v={offer} editing={editing && isDraft} draft={draft} setDraft={setDraft} />
            <FieldRow label="Joining Date" k="joiningDate" type="date" v={offer} editing={editing && isDraft} draft={draft} setDraft={setDraft} />
            <FieldRow label="Basic Salary (AED)" k="basicSalary" type="number" v={offer} editing={editing && isDraft} draft={draft} setDraft={setDraft} />
            <FieldRow label="Allowances (AED)" k="allowances" type="number" v={offer} editing={editing && isDraft} draft={draft} setDraft={setDraft} />
            <FieldRow label="Nationality" k="candidateNationality" v={offer} editing={editing && isDraft} draft={draft} setDraft={setDraft} />
            <FieldRow label="Passport No." k="candidatePassportNo" v={offer} editing={editing && isDraft} draft={draft} setDraft={setDraft} />
            <FieldRow label="Personal Email" k="candidatePersonalEmail" v={offer} editing={editing && isDraft} draft={draft} setDraft={setDraft} />
            <FieldRow label="Personal Phone" k="candidatePersonalPhone" v={offer} editing={editing && isDraft} draft={draft} setDraft={setDraft} />
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">Template</Label>
              {editing && isDraft ? (
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
              {editing && isDraft ? (
                <Textarea rows={4} value={draft.notes} onChange={e => setDraft((p: any) => ({ ...p, notes: e.target.value }))} />
              ) : (
                <div className="text-sm whitespace-pre-wrap">{offer.notes || <span className="text-muted-foreground">—</span>}</div>
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
                  ref={previewRef}
                  doc={{
                    letterNumber: offer.letterNumber,
                    candidateName: editing && isDraft ? (draft.candidateName || offer.candidateName) : offer.candidateName,
                    candidateNationality: editing && isDraft ? draft.candidateNationality : (offer as any).candidateNationality,
                    candidatePassportNo: editing && isDraft ? draft.candidatePassportNo : (offer as any).candidatePassportNo,
                    designation: editing && isDraft ? draft.designation : offer.designation,
                    joiningDate: editing && isDraft ? draft.joiningDate : offer.joiningDate,
                    basicSalary: editing && isDraft ? Number(draft.basicSalary || 0) : (offer as any).basicSalary,
                    allowances: editing && isDraft ? Number(draft.allowances || 0) : (offer as any).allowances,
                    templateType: editing && isDraft ? draft.templateType : offer.templateType,
                    workerType: editing && isDraft ? draft.workerType : (offer as any).workerType,
                    companyName: snapshotLegalName ?? (offer as any).companyName,
                    companyId: offer.companyId,
                    letterhead: resolvedLetterhead,
                    issuedAt: offer.issuedAt,
                    notes: editing && isDraft ? draft.notes : offer.notes,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
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
