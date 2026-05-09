import {
  useGetProformaInvoice, useGetQuotation,
  getGetProformaInvoiceQueryKey, getGetQuotationQueryKey,
  useCreateTaxInvoice, useListCompanies, useUpdateProformaInvoice,
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
import { ArrowLeft, Receipt, Pencil, FileText, Mail, Loader2, Download, Truck } from "lucide-react";
import { useEmailCompose } from "@/contexts/email-compose-context";
import { ExportButtons } from "@/components/export-buttons";
import { DocumentPrint } from "@/components/document-print";
import type { DocumentData } from "@/components/document-print";
import { SignatureStampPreview } from "@/components/signature-stamp-preview";
import { canSignDocuments } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { captureElementToPdfBase64, downloadBase64Pdf } from "@/lib/print-to-pdf";
import { useAuth } from "@/hooks/useAuth";

interface Props { id: string }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
};

export function ProformaInvoiceDetail({ id }: Props) {
  const pid = parseInt(id, 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { openCompose } = useEmailCompose();
  const queryClient = useQueryClient();
  const [converting, setConverting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertPaymentTerms, setConvertPaymentTerms] = useState("");
  const [convertNotes, setConvertNotes] = useState("");
  const [convertSupplyDate, setConvertSupplyDate] = useState("");

  const { data: pi, isLoading } = useGetProformaInvoice(pid, {
    query: { queryKey: getGetProformaInvoiceQueryKey(pid), enabled: !!pid },
  });
  const { data: companies } = useListCompanies();

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

  // Project-items subtotal to use for BAR 1
  const docSubtotal = isInstallment ? +(qSubtotal * fraction).toFixed(2) : subtotal;
  // Additional items scaled to the installment fraction
  const docAdditionalItems = isInstallment && additionalItems
    ? additionalItems.map(ai => ({ ...ai, price: +((ai.price ?? 0) * fraction).toFixed(2) }))
    : additionalItems;

  // Installment label row shown between BAR 2 and grand total
  const piPct = Math.round(fraction * 100);
  const installmentNote = isInstallment
    ? piPct > 50
      ? `${piPct}% Final Payment upon Delivery before Offloading`
      : `${piPct}% Advance Payment`
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
    additionalItems: docAdditionalItems,
    items: sourceItems.map((i: any) => ({
      description: i.description,
      sizeStatus: i.unit,
      unitPrice: i.rate ?? i.unitPrice,
      quantity: i.quantity,
      total: i.amount ?? i.total,
    })),
    preparedByName: (pi as any).preparedByName,
    printedByUniqueId: (user as any)?.uniqueUserId ?? undefined,
    clientCode: (pi as any).clientCode ?? undefined,
    preparedBySignatureUrl: (user as any)?.signatureUrl ?? undefined,
    stampUrl: companies?.find(c => c.id === pi.companyId)?.stamp ?? undefined,
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
      grandTotal: pi.total,
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
      } as Record<string, unknown>),
    } });
  };

  return (
    <>
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="no-print flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sales/proforma-invoices"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
        <Select value={pi.status} onValueChange={handleStatusChange} disabled={updatePi.isPending}>
          <SelectTrigger className={`h-7 w-32 text-xs font-medium capitalize border-0 ${STATUS_COLORS[pi.status] ?? "bg-gray-100 text-gray-700"}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
        {(pi as any)?.projectRef && (
          <Badge className="bg-[#0f2d5a] text-white border border-blue-300/40 font-mono text-[11px] tracking-wide px-2.5">
            PROJECT ID: {(pi as any).projectRef}
          </Badge>
        )}
        {(pi as any)?.clientCode && (
          <Badge className="bg-[#0f2d5a] text-[#c9a14a] border border-[#c9a14a]/30 font-mono text-[11px] tracking-wide">
            {(pi as any).clientCode}
          </Badge>
        )}
        {qid ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/sales/quotations/${qid}`}>
              <FileText className="w-4 h-4 mr-1" />Quotation {(quotation as any)?.quotationNumber ?? `#${qid}`}
            </Link>
          </Button>
        ) : null}
        {(quotation as any)?.leadId ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/crm/leads/${(quotation as any).leadId}`}>Lead</Link>
          </Button>
        ) : null}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/sales/proforma-invoices/${pid}/edit`}>
              <Pencil className="w-4 h-4 mr-1" />Edit
            </Link>
          </Button>
          <Button
            size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
            onClick={handleConvertToTax} disabled={converting}
          >
            <Receipt className="w-4 h-4 mr-1" />{converting ? "Creating…" : "Convert to Tax Invoice"}
          </Button>
          <Button
            size="sm" variant="outline"
            disabled={downloadingPdf}
            onClick={async () => {
              const docEl = document.querySelector<HTMLElement>(".print-doc");
              if (!docEl) return;
              setDownloadingPdf(true);
              try {
                const filename = `ProformaInvoice_${pi.piNumber ?? pi.id ?? "doc"}.pdf`;
                const signatureUrl = user?.signatureUrl || undefined;
                const co = companies?.find(c => c.id === pi.companyId);
                const stampUrl = co?.stamp || undefined;
                const stampWidthPct = co?.stampWidthPct ?? undefined;
                const stampMarginPct = co?.stampMarginPct ?? undefined;
                const { base64, filename: fname } = await captureElementToPdfBase64(docEl, filename, { signatureUrl, stampUrl, stampWidthPct, stampMarginPct });
                downloadBase64Pdf(base64, fname);
              } catch { /* silent */ } finally { setDownloadingPdf(false); }
            }}
          >
            {downloadingPdf ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Generating…</> : <><Download className="w-4 h-4 mr-1" />Download PDF</>}
          </Button>

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
                  const signatureUrl = user?.signatureUrl || undefined;
                  const co = companies?.find(c => c.id === pi.companyId);
                  const stampUrl = co?.stamp || undefined;
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
          <ExportButtons docNumber={pi.piNumber ?? pi.id?.toString() ?? "PI"} recipientPhone={(pi as any).clientPhone ?? undefined} recipientEmail={(pi as any).clientEmail ?? undefined} companyId={pi.companyId ?? undefined} docTypeLabel="Proforma Invoice" signatureUrl={user?.signatureUrl ?? undefined} stampUrl={companies?.find(c => c.id === pi.companyId)?.stamp ?? undefined} stampWidthPct={companies?.find(c => c.id === pi.companyId)?.stampWidthPct ?? undefined} stampMarginPct={companies?.find(c => c.id === pi.companyId)?.stampMarginPct ?? undefined} />
        </div>
      </div>
      {canSignDocuments((user as any)?.permissionLevel) && (
        <SignatureStampPreview
          signatureUrl={user?.signatureUrl ?? undefined}
          stampUrl={companies?.find(c => c.id === pi.companyId)?.stamp ?? undefined}
        />
      )}
      <DocumentPrint data={docData} />
    </div>

    {/* ── Convert to Tax Invoice Dialog ── */}
    <Dialog open={convertDialogOpen} onOpenChange={(o) => { if (!o) setConvertDialogOpen(false); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
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
            <span className="font-bold text-[#0f2d5a] tabular-nums">AED {Number(pi?.total ?? 0).toLocaleString()}</span>
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
          <Button onClick={handleConfirmConvertToTax} className="bg-[#0f2d5a] hover:bg-[#1e6ab0]">
            <Receipt className="w-4 h-4 mr-1" />Create Tax Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
