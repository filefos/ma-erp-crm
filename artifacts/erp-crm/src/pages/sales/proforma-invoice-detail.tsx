import {
  useGetProformaInvoice, useGetQuotation,
  getGetProformaInvoiceQueryKey, getGetQuotationQueryKey,
  useCreateTaxInvoice, useListCompanies,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Receipt, Pencil, FileText, Mail, Loader2, Download } from "lucide-react";
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
  const [converting, setConverting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { data: pi, isLoading } = useGetProformaInvoice(pid, {
    query: { queryKey: getGetProformaInvoiceQueryKey(pid), enabled: !!pid },
  });
  const { data: companies } = useListCompanies();

  const qid = (pi as any)?.quotationId as number | undefined;
  const { data: quotation } = useGetQuotation(qid!, {
    query: { queryKey: getGetQuotationQueryKey(qid!), enabled: !!qid },
  });

  const createTax = useCreateTaxInvoice({
    mutation: {
      onSuccess: (inv) => {
        toast({ title: "Tax Invoice created!", description: inv.invoiceNumber });
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

  const docData: DocumentData = {
    type: "proforma",
    docNumber: pi.piNumber,
    companyId: pi.companyId,
    companyRef: (pi as any).companyRef,
    companyLogo: (companies?.find(c => c.id === pi.companyId) as any)?.logo ?? undefined,
    clientName: pi.clientName,
    clientEmail: (pi as any).clientEmail,
    clientPhone: (pi as any).clientPhone,
    clientTrn: (pi as any).clientTrn ?? undefined,
    companyTrn: (pi as any).companyTrn ?? undefined,
    projectName: pi.projectName,
    projectRef: (pi as any).projectRef ?? undefined,
    projectLocation: (pi as any).projectLocation,
    date: pi.createdAt ? new Date(pi.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : undefined,
    validity: pi.validityDate,
    subtotal,
    vatPercent,
    vatAmount,
    grandTotal: pi.total,
    paymentTerms: pi.paymentTerms,
    notes: (pi as any).notes,
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
  };

  const handleConvertToTax = () => {
    if (converting) return;
    setConverting(true);
    const today = new Date().toISOString().split("T")[0];
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
        paymentTerms: pi.paymentTerms,
        clientCode: (pi as any).clientCode,
        clientTrn: (pi as any).clientTrn ?? (pi as any).customerTrn,
        companyTrn: (pi as any).companyTrn,
        clientEmail: (pi as any).clientEmail,
        clientPhone: (pi as any).clientPhone,
        projectLocation: (pi as any).projectLocation,
      } as Record<string, unknown>),
    } });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="no-print flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sales/proforma-invoices"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
        <Badge className={`capitalize ${STATUS_COLORS[pi.status] ?? "bg-gray-100"}`}>{pi.status}</Badge>
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
                const stampUrl = companies?.find(c => c.id === pi.companyId)?.stamp || undefined;
                const { base64, filename: fname } = await captureElementToPdfBase64(docEl, filename, { signatureUrl, stampUrl });
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
                  const stampUrl = companies?.find(c => c.id === pi.companyId)?.stamp || undefined;
                  const { base64 } = await captureElementToPdfBase64(docEl, filename, { signatureUrl, stampUrl });
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
          <ExportButtons docNumber={pi.piNumber ?? pi.id?.toString() ?? "PI"} recipientPhone={(pi as any).clientPhone ?? undefined} recipientEmail={(pi as any).clientEmail ?? undefined} companyId={pi.companyId ?? undefined} docTypeLabel="Proforma Invoice" signatureUrl={user?.signatureUrl ?? undefined} stampUrl={companies?.find(c => c.id === pi.companyId)?.stamp ?? undefined} />
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
  );
}
