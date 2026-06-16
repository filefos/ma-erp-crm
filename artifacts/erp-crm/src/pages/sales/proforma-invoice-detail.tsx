import {
  useGetProformaInvoice, useGetQuotation,
  getGetProformaInvoiceQueryKey, getGetQuotationQueryKey,
  useCreateTaxInvoice, useListCompanies, getListCompaniesQueryKey, useUpdateProformaInvoice,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Receipt, FileText, Truck, Mail, Loader2 } from "lucide-react";
import { RevisionHistoryPanel } from "@/components/revision-history-panel";
import { useEmailCompose } from "@/contexts/email-compose-context";
import { DocumentPrint } from "@/components/document-print";
import type { DocumentData } from "@/components/document-print";
import { SignatureStampPreview } from "@/components/signature-stamp-preview";
import { canSignDocuments } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { captureElementToPdfBase64 } from "@/lib/print-to-pdf";
import { DocumentActionBar } from "@/components/document-action-bar";
import { useAuth } from "@/hooks/useAuth";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { parsePaymentTerms } from "@/lib/payment-terms";

interface Props { id: string }

const STATUS_COLORS: Record<string, string> = {
  draft:              "bg-gray-100 text-gray-700",
  pending:            "bg-orange-100 text-orange-800",
  approved:           "bg-green-100 text-green-800",
  paid:               "bg-emerald-100 text-emerald-800",
  unpaid:             "bg-red-100 text-red-800",
  approved_not_paid:  "bg-blue-100 text-blue-800",
};

export function ProformaInvoiceDetail({ id }: Props) {
  const { activeCompanyId } = useActiveCompany();
  const pid = parseInt(id, 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = ["super_admin", "company_admin"].includes((user as any)?.permissionLevel ?? "");
  const { openCompose } = useEmailCompose();
  const queryClient = useQueryClient();
  const [converting, setConverting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const handleUnlock = async () => {
    setLockLoading(true);
    try {
      const token = localStorage.getItem("erp_token");
      const res = await fetch(`/api/proforma-invoices/${pid}/unlock`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to unlock"); }
      queryClient.invalidateQueries();
      toast({ title: "Document unlocked." });
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setLockLoading(false); }
  };
  const handleLock = async () => {
    setLockLoading(true);
    try {
      const token = localStorage.getItem("erp_token");
      const res = await fetch(`/api/proforma-invoices/${pid}/lock`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed to lock"); }
      queryClient.invalidateQueries();
      toast({ title: "Document locked." });
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setLockLoading(false); }
  };
  const [showSignature, setShowSignature] = useState(true);
  const [showStamp, setShowStamp] = useState(true);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertPaymentTerms, setConvertPaymentTerms] = useState("");
  const [convertNotes, setConvertNotes] = useState("");
  const [convertSupplyDate, setConvertSupplyDate] = useState("");

  const { data: pi, isLoading } = useGetProformaInvoice(pid, {
    query: { queryKey: getGetProformaInvoiceQueryKey(pid), enabled: !!pid },
  });
  const { data: companies } = useListCompanies({ query: { queryKey: getListCompaniesQueryKey(), staleTime: 0 } });

  const qid = (pi as any)?.quotationId as number | undefined;
  const { data: quotation } = useGetQuotation(qid!, {
    query: { queryKey: getGetQuotationQueryKey(qid!), enabled: !!qid },
  });

  const updatePi = useUpdateProformaInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProformaInvoiceQueryKey(pid) });
        toast({ title: "Status updated." });
      },
      onError: () => toast({ title: "Failed to update status.", variant: "destructive" }),
    },
  });

  const handleStatusChange = (newStatus: string) => {
    if (!pi) return;
    updatePi.mutate({ id: pid, data: { companyId: pi.companyId, status: newStatus } as any });
  };

  const createTax = useCreateTaxInvoice({
    mutation: {
      onSuccess: (inv) => {
        const dnNum = (inv as any).autoDeliveryNoteNumber;
        const dnId = (inv as any).autoDeliveryNoteId;
        toast({
          title: "Tax Invoice created!",
          description: dnNum
            ? `${inv.invoiceNumber} · Delivery Note ${dnNum} (draft) also created`
            : inv.invoiceNumber,
          ...(dnId ? {
            action: (
              <a href={`/accounts/delivery-notes/${dnId}`} className="underline text-xs whitespace-nowrap">
                View DN
              </a>
            ) as any,
          } : {}),
        });
        navigate("/accounts/invoices/" + inv.id);
      },
      onError: () => toast({ title: "Failed to create Tax Invoice.", variant: "destructive" }),
      onSettled: () => setConverting(false),
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;
  if (!pi) return <div className="text-muted-foreground p-8">Proforma Invoice not found.</div>;

  // Use PI's own items first; fall back to quotation items if PI has none
  const piRawItems = (pi as any)?.items ?? [];
  const piItems = Array.isArray(piRawItems) ? piRawItems : [];
  
  const qItems = ((quotation as any)?.items ?? []) as {
    description: string; unit?: string; rate?: number; quantity: number; amount?: number;
  }[];

  const sourceItems = piItems.length > 0 ? piItems : qItems;

  const subtotal = (pi as any).subtotal ?? sourceItems.reduce((s: number, i: any) => s + (i.amount ?? (i.rate ?? 0) * (i.quantity ?? 1)), 0);
  const vatPercent = (pi as any).vatPercent ?? 5;
  const vatAmount = (pi as any).vatAmount ?? (subtotal * vatPercent / 100);

  // Inherit additional commercial items from the source quotation so the
  // proforma matches the quotation exactly (prices, included/excluded status).
  let additionalItems: import("@/components/document-print").AdditionalCommercialItem[] | undefined;
  try {
    const raw = (quotation as any)?.additionalItems;
    if (raw) additionalItems = JSON.parse(raw);
  } catch { /* fall back to document-print defaults */ }

  // For installment PIs (e.g. 30%) the stored pi.subtotal = combined_base × 30%.
  // document-print uses data.subtotal as "project items only" (BAR 1) and then
  // ADDS the full additional items on top — which produces wrong totals.
  // Fix: scale both the project-items subtotal and additional-item prices by the
  // installment fraction so document-print's arithmetic gives the correct result.
  //
  //  fraction   = pi.subtotal / (q.subtotal + included_additional)
  //             = 8,970 / (24,700 + 5,200)  = 0.30
  //  docSubtotal = q.subtotal × fraction     = 7,410   ← BAR 1
  //  scaled additional: 3,000 × 0.3 = 900, 2,200 × 0.3 = 660
  //  BAR 2 = 7,410 + 900 + 660              = 8,970  ✓
  //  VAT 5%                                 = 448.50 ✓
  //  Grand Total                            = 9,418.50 ✓
  const qSubtotal = (quotation as any)?.subtotal as number | undefined ?? 0;
  const qAdditionalIncluded = (additionalItems ?? []).reduce(
    (s, ai) => s + (ai.status === "Included" ? ((ai.price ?? 0) * (ai.quantity ?? 1)) : 0), 0
  );
  const qCombinedBase = qSubtotal + qAdditionalIncluded;
  // Only scale when the quotation is loaded and the PI is a partial installment
  const fraction = qCombinedBase > 0 ? subtotal / qCombinedBase : 1;
  const isInstallment = fraction < 0.9999 && qCombinedBase > 0;

  // Always show full contract amounts in Module 1 (the document body).
  // For installment PIs: use the full quotation project-items subtotal so BAR 1,
  // BAR 2, VAT, and Grand Total reflect the entire contract value.
  // The installment breakdown appears in Module 2 (Payment Schedule table below).
  // For non-installment PIs: subtract qAdditionalIncluded so BAR 1 shows project
  // items only (document-print adds additionalTotal separately).
  const docSubtotal = isInstallment
    ? qSubtotal
    : +(subtotal - qAdditionalIncluded).toFixed(2);
  // Always use full (unscaled) additional item prices
  const docAdditionalItems = additionalItems;

  // Installment label row shown between BAR 2 and grand total.
  // Find the matching stage from payment terms so the label is accurate
  // (e.g. "Progress Payment" not "Advance Payment" for a 2.38% stage).
  const exactPct = fraction * 100;
  const qtInstallments = parsePaymentTerms((quotation as any)?.paymentTerms);
  const matchedStage = qtInstallments.length > 0
    ? qtInstallments.reduce((best, inst) =>
        Math.abs(inst.percent - exactPct) < Math.abs(best.percent - exactPct) ? inst : best
      )
    : null;
  const cleanPct = matchedStage
    ? `${+matchedStage.percent.toFixed(2)}%`
    : `${Math.round(exactPct)}%`;
  const installmentNote = isInstallment
    ? matchedStage
      ? `${cleanPct} ${matchedStage.label}`
      : `${cleanPct} Payment`
    : undefined;

  // Format raw ISO validity date (e.g. "2026-05-09") to "09 May 2026"
  const rawValidity = (pi as any).validityDate as string | null | undefined;
  const validity = rawValidity
    ? /^\d{4}-\d{2}-\d{2}$/.test(rawValidity)
      ? new Date(rawValidity + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : rawValidity
    : undefined;

  const docData: DocumentData = {
    type: "proforma",
    docNumber: pi.piNumber,
    companyId: pi.companyId,
    companyRef: (pi as any).companyRef,
    companyLogo: (companies?.find(c => c.id === pi.companyId) as any)?.logo ?? undefined,
    clientName: pi.clientName,
    clientContactPerson: (pi as any).clientContactPerson ?? (quotation as any)?.clientContactPerson ?? undefined,
    clientEmail: (pi as any).clientEmail,
    clientPhone: (pi as any).clientPhone,
    clientTrn: (pi as any).clientTrn ?? undefined,
    companyTrn: (pi as any).companyTrn ?? undefined,
    projectName: pi.projectName,
    projectRef: (pi as any).projectRef ?? undefined,
    projectLocation: (pi as any).projectLocation,
    date: pi.createdAt ? new Date(pi.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : undefined,
    validity,
    subtotal: docSubtotal,
    vatPercent,
    vatAmount,
    grandTotal: pi.total,
    paymentTerms: pi.paymentTerms ?? (quotation as any)?.paymentTerms,
    notes: (pi as any).notes,
    installmentNote,
    installmentFraction: isInstallment ? fraction : undefined,
    additionalItems: docAdditionalItems,
    items: sourceItems.map((i: any) => ({
      description: i.description,
      sizeStatus: i.sizeStatus ?? i.unit,
      unitPrice: i.rate ?? i.unitPrice,
      quantity: i.quantity,
      total: i.amount ?? i.total,
    })),
    preparedByName: (pi as any)?.creatorName ?? (pi as any)?.preparedByName ?? undefined,
    printedByUniqueId: (pi as any)?.creatorUniqueId ?? (user as any)?.uniqueUserId ?? undefined,
    salesPersonContact: (pi as any)?.creatorName ?? (pi as any)?.preparedByName ?? undefined,
    salesPersonPhone: (pi as any)?.creatorPhone ?? undefined,
    salesPersonEmail: (pi as any)?.creatorEmail ?? undefined,
    salesPersonDesignation: (pi as any)?.creatorDesignation ?? undefined,
    clientDesignation: (pi as any)?.clientDesignation ?? undefined,
    clientCode: (pi as any).clientCode ?? undefined,
    clientAddress: (pi as any)?.clientAddress ?? undefined,
    lpoRef: (pi as any).lpoNumber ?? undefined,
    preparedBySignatureUrl: showSignature ? ((pi as any)?.creatorSignatureUrl ?? (user as any)?.signatureUrl ?? undefined) : undefined,
    stampUrl: showStamp ? (companies?.find(c => c.id === pi.companyId)?.stamp ?? undefined) : undefined,
  };

  const handleConvertToTax = () => {
    if (converting) return;
    setConvertPaymentTerms(pi.paymentTerms ?? "");
    setConvertNotes("");
    setConvertSupplyDate(new Date().toISOString().split("T")[0]);
    setConvertDialogOpen(true);
  };

  const handleConfirmConvertToTax = () => {
    setConvertDialogOpen(false);
    setConverting(true);
    const today = convertSupplyDate || new Date().toISOString().split("T")[0];
    const computedGrandTotal = +(subtotal + vatAmount).toFixed(2);
    createTax.mutate({ data: {
      companyId: pi.companyId,
      clientName: pi.clientName,
      projectName: pi.projectName,
      quotationId: qid,
      invoiceDate: today,
      supplyDate: today,
      subtotal,
      vatPercent,
      vatAmount,
      grandTotal: pi.total || computedGrandTotal,
      paymentStatus: "unpaid",
      ...({
        paymentTerms: convertPaymentTerms || pi.paymentTerms,
        notes: convertNotes || undefined,
        clientCode: (pi as any).clientCode,
        clientTrn: (pi as any).clientTrn ?? (pi as any).customerTrn,
        companyTrn: (pi as any).companyTrn,
        clientEmail: (pi as any).clientEmail,
        clientPhone: (pi as any).clientPhone,
        projectLocation: (pi as any).projectLocation,
        projectRef: (pi as any).projectRef,
        lpoNumber: (pi as any).lpoNumber ?? undefined,
        contactId: (pi as any).contactId ?? undefined,
      } as Record<string, unknown>),
    } });
  };

  return (
    <>
    <div className="max-w-4xl mx-auto space-y-4">
      {(pi as any)?.isUserDeleted && (isAdmin || (pi as any)?.userDeletedById === (user as any)?.id) && (
        <div className="no-print bg-orange-50 border border-orange-300 text-orange-700 rounded-lg px-4 py-3 text-sm font-semibold flex items-center gap-2">
          <span>⏳</span> This document has a pending deletion request awaiting admin approval.
        </div>
      )}
      {(pi as any)?.deleteRejectedAt && (isAdmin || (pi as any)?.userDeletedById === (user as any)?.id) && (
        <div className="no-print bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-3 text-sm font-semibold flex flex-col gap-2">
          <div className="flex items-center gap-2"><span>✕</span>Deletion Rejected{(pi as any).deleteRejectionNote ? `: ${(pi as any).deleteRejectionNote}` : ""}</div>
          <div className="flex gap-2">
            <button className="text-xs px-3 py-1 rounded bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 cursor-pointer" onClick={async () => { const t = localStorage.getItem("erp_token"); await fetch(`/api/pending-document-deletions/proforma_invoice/${pi.id}/dismiss-rejection`, { method: "POST", headers: { Authorization: `Bearer ${t}` } }); window.location.reload(); }}>Dismiss</button>
            <span className="text-xs text-red-500/70 self-center">Use the Delete button below to re-request deletion.</span>
          </div>
        </div>
      )}
      <RevisionHistoryPanel
        apiPath={`/api/proforma-invoices/${pid}/revisions`}
        currentId={pid}
        detailBasePath="/accounts/proforma-invoices"
      />

      <DocumentActionBar
        backHref="/accounts/proforma-invoices"
        statusNode={
          <Select value={pi.status} onValueChange={handleStatusChange} disabled={updatePi.isPending}>
            <SelectTrigger className={`h-7 w-44 text-xs font-medium capitalize border-0 ${STATUS_COLORS[pi.status] ?? "bg-gray-100 text-gray-700"}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="approved_not_paid">Approved — Not Paid Yet</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        }
        clientCode={(pi as any)?.clientCode}
        clientCodeHref={(pi as any)?.contactId ? `/crm/contacts/${(pi as any).contactId}` : undefined}
        extraRow1={
          (pi as any)?.projectRef ? (
            <Badge className="bg-[#1E0040] text-white border border-blue-300/40 font-mono text-[11px] tracking-wide px-2.5">
              PROJECT ID: {(pi as any).projectRef}
            </Badge>
          ) : undefined
        }
        sourceLinkNode={
          qid ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/sales/quotations/${qid}`}>
                <FileText className="w-4 h-4 mr-1" />Quotation {(quotation as any)?.quotationNumber ?? `#${qid}`}
              </Link>
            </Button>
          ) : undefined
        }
        leadHref={(quotation as any)?.leadId ? `/crm/leads/${(quotation as any).leadId}` : undefined}
        isLocked={(pi as any)?.isLocked}
        permissionLevel={(user as any)?.permissionLevel}
        showStamp={showStamp}
        onStampToggle={() => setShowStamp(s => !s)}
        showSignature={showSignature}
        onSignatureToggle={() => setShowSignature(s => !s)}
        editHref={`/accounts/proforma-invoices/${pid}/edit`}
        editLabel="Edit / Revise"
        lockLoading={lockLoading}
        onLock={handleLock}
        onUnlock={handleUnlock}
        extraActionsRow2={
          <Button
            size="sm" variant="outline"
            disabled={generatingPdf}
            onClick={async () => {
              const docEl = document.querySelector<HTMLElement>(".print-doc");
              let attachments: { filename: string; content: string; contentType: string; size: number }[] = [];
              if (docEl) {
                setGeneratingPdf(true);
                try {
                  const filename = `ProformaInvoice_${pi.piNumber ?? pi.id ?? "doc"}.pdf`;
                  const signatureUrl = showSignature ? (user?.signatureUrl || undefined) : undefined;
                  const co = companies?.find(c => c.id === pi.companyId);
                  const stampUrl = showStamp ? (co?.stamp || undefined) : undefined;
                  const stampWidthPct = co?.stampWidthPct ?? undefined;
                  const stampMarginPct = co?.stampMarginPct ?? undefined;
                  const { base64 } = await captureElementToPdfBase64(docEl, filename, { signatureUrl, stampUrl, stampWidthPct, stampMarginPct });
                  attachments = [{ filename, content: base64, contentType: "application/pdf", size: Math.round(base64.length * 0.75) }];
                } catch { /* fall through */ } finally { setGeneratingPdf(false); }
              }
              openCompose({
                toAddress: (pi as any).clientEmail ?? "",
                toName: pi.clientName ?? "",
                subject: `Proforma Invoice ${pi.piNumber ?? ""} – ${pi.projectName ?? pi.clientName ?? ""}`,
                body: `Dear ${pi.clientName ?? "Sir/Madam"},\n\nPlease find attached Proforma Invoice ${pi.piNumber ?? ""} for ${pi.projectName ?? "your project"}.\n\nTotal Value: AED ${Number(pi.total ?? 0).toLocaleString()}\n\nKindly review and confirm your acceptance.\n\nBest regards,\nPrime Max Prefab`,
                clientName: pi.clientName ?? "",
                sourceRef: pi.piNumber ?? "",
                companyId: pi.companyId ?? undefined,
                attachments,
              });
            }}
          >
            {generatingPdf ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Preparing PDF…</> : <><Mail className="w-4 h-4 mr-1" />Send Email</>}
          </Button>
        }
        convertToNode={
          <Button size="sm" className="btn-brand" onClick={handleConvertToTax} disabled={converting}>
            <Receipt className="w-4 h-4 mr-1" />{converting ? "Creating…" : "Convert to Tax Invoice"}
          </Button>
        }
        docNumber={pi.piNumber ?? pi.id?.toString() ?? "PI"}
        recipientPhone={(pi as any).clientPhone ?? undefined}
        recipientEmail={(pi as any).clientEmail ?? undefined}
        companyId={pi.companyId ?? undefined}
        docTypeLabel="Proforma Invoice"
        signatureUrl={showSignature ? (user?.signatureUrl ?? undefined) : undefined}
        stampUrl={showStamp ? (companies?.find(c => c.id === pi.companyId)?.stamp ?? undefined) : undefined}
        stampWidthPct={companies?.find(c => c.id === pi.companyId)?.stampWidthPct ?? undefined}
        stampMarginPct={companies?.find(c => c.id === pi.companyId)?.stampMarginPct ?? undefined}
      />
      {canSignDocuments((user as any)?.permissionLevel) && (
        <SignatureStampPreview
          signatureUrl={showSignature ? (user?.signatureUrl ?? undefined) : undefined}
          stampUrl={showStamp ? (companies?.find(c => c.id === pi.companyId)?.stamp ?? undefined) : undefined}
        />
      )}
      {/* Admin metadata panel — visible to manager / admin / super_admin only */}
      {["manager", "company_admin", "super_admin"].includes((user as any)?.permissionLevel ?? "") && (
        <div className="no-print bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-xs text-slate-700 flex flex-wrap gap-x-5 gap-y-1">
          <span><span className="font-semibold text-slate-500">Created By:</span> {(pi as any)?.creatorName ?? "—"}</span>
          <span><span className="font-semibold text-slate-500">User ID:</span>{" "}{(pi as any)?.createdById ? <Link href="/admin/users" className="text-blue-600 hover:underline font-mono">{(pi as any).createdById}</Link> : "—"}</span>
          <span><span className="font-semibold text-slate-500">Unique ID:</span>{" "}{(pi as any)?.creatorUniqueId ? <Link href="/admin/users" className="text-blue-600 hover:underline font-mono">{(pi as any).creatorUniqueId}</Link> : "—"}</span>
          <span><span className="font-semibold text-slate-500">Designation:</span> {(pi as any)?.creatorDesignation ?? "—"}</span>
          <span><span className="font-semibold text-slate-500">Status:</span> {(pi as any)?.isLocked ? "🔒 Locked" : "🔓 Unlocked"}</span>
          <span><span className="font-semibold text-slate-500">Created:</span> {(pi as any)?.createdAt ? new Date((pi as any).createdAt).toLocaleDateString("en-GB") : "—"}</span>
        </div>
      )}
      <DocumentPrint data={docData} />
    </div>

    {/* ── Convert to Tax Invoice Dialog ── */}
    <Dialog open={convertDialogOpen} onOpenChange={(o) => { if (!o) setConvertDialogOpen(false); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="dlg-corp-header">
          <DialogTitle>Convert to Tax Invoice</DialogTitle>
          <DialogDescription>
            Review and confirm the details below. A Delivery Note (draft) will be
            automatically created and linked to this Tax Invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary card */}
          <div className="rounded-md border bg-muted/40 p-3 text-sm grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Proforma Invoice</span>
            <span className="font-mono font-semibold">{pi?.piNumber}</span>
            <span className="text-muted-foreground">Client</span>
            <span className="font-medium">{pi?.clientName}</span>
            <span className="text-muted-foreground">Subtotal (excl. VAT)</span>
            <span className="tabular-nums">AED {subtotal.toLocaleString()}</span>
            <span className="text-muted-foreground">VAT ({vatPercent}%)</span>
            <span className="tabular-nums">AED {vatAmount.toLocaleString()}</span>
            <span className="text-muted-foreground font-semibold">Grand Total</span>
            <span className="font-bold text-[#1E0040] tabular-nums">AED {Number(pi?.total ?? 0).toLocaleString()}</span>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Invoice / Supply Date</Label>
            <Input
              type="date"
              value={convertSupplyDate}
              onChange={e => setConvertSupplyDate(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Payment Terms</Label>
            <Input
              value={convertPaymentTerms}
              onChange={e => setConvertPaymentTerms(e.target.value)}
              className="h-8 text-sm"
              placeholder="e.g. Full Contract Value"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={convertNotes}
              onChange={e => setConvertNotes(e.target.value)}
              className="text-sm min-h-[60px] resize-none"
              placeholder="Any notes for this invoice…"
            />
          </div>

          <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
            <Truck className="w-3.5 h-3.5 flex-shrink-0" />
            <span>A Delivery Note (draft) will be automatically created and linked to this Tax Invoice.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmConvertToTax} className="btn-brand">
            <Receipt className="w-4 h-4 mr-1" />Create Tax Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
