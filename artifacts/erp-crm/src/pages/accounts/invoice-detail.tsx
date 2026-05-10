import {
  useGetTaxInvoice, useGetQuotation,
  getGetTaxInvoiceQueryKey, getGetQuotationQueryKey,
  useCreateDeliveryNote, useListCompanies,
  useDeleteTaxInvoice, getListTaxInvoicesQueryKey, useUpdateTaxInvoice,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Package, Pencil, FileText, BookOpen, BarChart2, Mail, Loader2, Download, Trash2 } from "lucide-react";
import { useEmailCompose } from "@/contexts/email-compose-context";
import { ExportButtons } from "@/components/export-buttons";
import { DocumentPrint } from "@/components/document-print";
import type { DocumentData } from "@/components/document-print";
import { SignatureStampPreview } from "@/components/signature-stamp-preview";
import { canSignDocuments } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useState, useEffect } from "react";
import { captureElementToPdfBase64, downloadBase64Pdf } from "@/lib/print-to-pdf";
import { useAuth } from "@/hooks/useAuth";
import { authHeaders } from "@/lib/ai-client";
import { useQueryClient } from "@tanstack/react-query";

interface Props { id: string }

const PAYMENT_COLORS: Record<string, string> = {
  unpaid: "bg-red-100 text-red-800",
  partial: "bg-orange-100 text-orange-800",
  paid: "bg-green-100 text-green-800",
};

export function InvoiceDetail({ id }: Props) {
  const { activeCompanyId } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const primeBtnCls = isElite ? "bg-[#0D0D0D] hover:bg-[#8B0000]" : "bg-[#0f2d5a] hover:bg-[#1e6ab0]";
  const invId = parseInt(id, 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { openCompose } = useEmailCompose();
  const queryClient = useQueryClient();
  const [converting, setConverting] = useState(false);
  const [creatingJournal, setCreatingJournal] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteMutation = useDeleteTaxInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTaxInvoicesQueryKey() });
        toast({ title: "Tax Invoice deleted." });
        navigate("/accounts/invoices");
      },
      onError: () => toast({ title: "Failed to delete.", variant: "destructive" }),
    },
  });

  const updateInv = useUpdateTaxInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTaxInvoiceQueryKey(invId) });
        toast({ title: "Payment status updated." });
      },
      onError: () => toast({ title: "Failed to update payment status.", variant: "destructive" }),
    },
  });

  const handlePaymentStatusChange = (newStatus: string) => {
    if (!inv) return;
    updateInv.mutate({ id: invId, data: { companyId: inv.companyId, paymentStatus: newStatus } as any });
  };

  const handleAutoJournal = async () => {
    if (creatingJournal) return;
    setCreatingJournal(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/journal-entries/auto-from-source`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify({ sourceType: "tax_invoice", sourceId: invId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast({ title: "Could not create draft", description: j?.message ?? `HTTP ${res.status}`, variant: "destructive" });
        return;
      }
      const j = await res.json();
      toast({ title: "Draft journal created", description: `${j.journalNumber} — review and approve in Journal Entries.` });
      navigate(`/accounts/journal-entries`);
    } catch (e) {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setCreatingJournal(false);
    }
  };

  const { data: inv, isLoading } = useGetTaxInvoice(invId, {
    query: { queryKey: getGetTaxInvoiceQueryKey(invId), enabled: !!invId },
  });
  const { data: companies } = useListCompanies();

  const qid = (inv as any)?.quotationId as number | undefined;
  const { data: quotation } = useGetQuotation(qid!, {
    query: { queryKey: getGetQuotationQueryKey(qid!), enabled: !!qid },
  });

  const createDN = useCreateDeliveryNote({
    mutation: {
      onSuccess: (dn) => {
        toast({ title: "Delivery Note created!", description: dn.dnNumber });
        navigate("/accounts/delivery-notes/" + dn.id);
      },
      onError: () => toast({ title: "Failed to create Delivery Note.", variant: "destructive" }),
      onSettled: () => setConverting(false),
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;
  if (!inv) return <div className="text-muted-foreground p-8">Invoice not found.</div>;

  const qItems = ((quotation as any)?.items ?? []) as {
    description: string; unit?: string; quantity: number; amount?: number;
  }[];

  // Parse the invoice's own line items (stored as JSON text) and fall back
  // to quotation items only when the invoice has none of its own.
  const invItemsRaw: any[] = (() => {
    try { return JSON.parse((inv as any).items ?? "[]"); } catch { return []; }
  })();
  const sourceItems = invItemsRaw.length > 0 ? invItemsRaw : qItems;

  // Inherit additional commercial items from the quotation, scaled to the
  // installment fraction — same logic as proforma-invoice-detail.
  // e.g. 70% Tax Invoice: fraction = inv.subtotal / (q.subtotal + qAdditional)
  //                      = 20,930 / 29,900 = 0.70
  //   → Transportation 2,100, AC Unit 1,540 shown between BAR 1 and BAR 2
  let additionalItems: import("@/components/document-print").AdditionalCommercialItem[] | undefined;
  try {
    const raw = (quotation as any)?.additionalItems;
    if (raw) additionalItems = JSON.parse(raw);
  } catch { /* fall back to document-print defaults */ }

  const qSubtotal = (quotation as any)?.subtotal as number | undefined ?? 0;
  const qAdditionalIncluded = (additionalItems ?? []).reduce(
    (s, ai) => s + (ai.status === "Included" ? ((ai.price ?? 0) * (ai.quantity ?? 1)) : 0), 0
  );
  const qCombinedBase = qSubtotal + qAdditionalIncluded;
  const invSubtotal = inv.subtotal ?? 0;
  const fraction = qCombinedBase > 0 ? invSubtotal / qCombinedBase : 1;
  const isInstallment = fraction < 0.9999 && qCombinedBase > 0;

  // Project-items-only portion for BAR 1 of the tax invoice
  const docSubtotal = isInstallment ? +(qSubtotal * fraction).toFixed(2) : invSubtotal;
  // Scale additional item prices to the installment percentage
  const docAdditionalItems = isInstallment && additionalItems
    ? additionalItems.map(ai => ({ ...ai, price: +((ai.price ?? 0) * fraction).toFixed(2) }))
    : additionalItems;

  // Installment label row shown between BAR 2 and grand total
  const pct = Math.round(fraction * 100);
  const installmentNote = isInstallment
    ? pct > 50
      ? `${pct}% Final Payment upon Delivery before Offloading`
      : `${pct}% Advance Payment`
    : undefined;

  const docData: DocumentData = {
    type: "tax_invoice",
    docNumber: inv.invoiceNumber,
    companyId: inv.companyId,
    companyRef: (inv as any).companyRef,
    clientName: inv.clientName,
    clientTrn: inv.clientTrn,
    companyTrn: (inv as any).companyTrn ?? undefined,
    projectRef: (inv as any).projectRef ?? undefined,
    invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : undefined,
    supplyDate: inv.supplyDate ? new Date(inv.supplyDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : undefined,
    subtotal: docSubtotal,
    vatPercent: inv.vatPercent ?? 5,
    vatAmount: inv.vatAmount,
    grandTotal: inv.grandTotal,
    paymentTerms: (inv as any).paymentTerms ?? undefined,
    notes: (inv as any).notes ?? undefined,
    installmentNote,
    additionalItems: docAdditionalItems,
    items: sourceItems.map((i: any) => ({
      description: i.description,
      sizeStatus: i.unit ?? i.sizeStatus,
      unitPrice: i.rate ?? i.unitPrice,
      quantity: i.quantity ?? 1,
      total: i.amount ?? i.total,
      vatPercent: i.vatPercent,
    })),
    companyLogo: (companies?.find((c: any) => c.id === inv.companyId) as any)?.logo ?? undefined,
    printedByUniqueId: (user as any)?.uniqueUserId ?? undefined,
    clientCode: (inv as any).clientCode ?? undefined,
    preparedBySignatureUrl: (user as any)?.signatureUrl ?? undefined,
    stampUrl: companies?.find((c: any) => c.id === inv.companyId)?.stamp ?? undefined,
  };

  const handleCreateDN = () => {
    if (converting) return;
    setConverting(true);
    createDN.mutate({ data: {
      companyId: inv.companyId,
      clientName: inv.clientName,
      taxInvoiceId: inv.id,
      deliveryDate: new Date().toISOString().split("T")[0],
      items: qItems.map(i => ({
        description: i.description,
        quantity: i.quantity,
        unit: i.unit ?? "nos",
      })),
    } });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="no-print flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/accounts/invoices"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
        <Select value={inv.paymentStatus} onValueChange={handlePaymentStatusChange} disabled={updateInv.isPending}>
          <SelectTrigger className={`h-7 w-32 text-xs font-medium capitalize border-0 ${PAYMENT_COLORS[inv.paymentStatus] ?? "bg-gray-100 text-gray-700"}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        {(inv as any)?.projectRef && (
          <Badge className="bg-[#0f2d5a] text-white border border-blue-300/40 font-mono text-[11px] tracking-wide px-2.5">
            PROJECT ID: {(inv as any).projectRef}
          </Badge>
        )}
        {(inv as any)?.clientCode && (
          <Badge className="bg-[#0f2d5a] text-[#c9a14a] border border-[#c9a14a]/30 font-mono text-[11px] tracking-wide">
            {(inv as any).clientCode}
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
        {(inv as any)?.projectId ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/projects/${(inv as any).projectId}`}>
              <BarChart2 className="w-4 h-4 mr-1" />Project
            </Link>
          </Button>
        ) : null}
        <div className="ml-auto flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/accounts/invoices/${invId}/edit`}>
              <Pencil className="w-4 h-4 mr-1" />Edit
            </Link>
          </Button>
          <Button
            size="sm" variant="outline"
            className="text-destructive border-destructive/40 hover:bg-destructive hover:text-white"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="w-4 h-4 mr-1" />Delete
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={handleAutoJournal} disabled={creatingJournal}
            data-testid="button-auto-journal"
          >
            <BookOpen className="w-4 h-4 mr-1" />{creatingJournal ? "Creating…" : "Suggest Journal Entry"}
          </Button>
          <Button
            size="sm" className={primeBtnCls}
            onClick={handleCreateDN} disabled={converting}
          >
            <Package className="w-4 h-4 mr-1" />{converting ? "Creating…" : "Create Delivery Note"}
          </Button>
          <Button
            size="sm" variant="outline"
            disabled={downloadingPdf}
            onClick={async () => {
              const docEl = document.querySelector<HTMLElement>(".print-doc");
              if (!docEl) return;
              setDownloadingPdf(true);
              try {
                const filename = `TaxInvoice_${inv.invoiceNumber ?? inv.id ?? "doc"}.pdf`;
                const signatureUrl = user?.signatureUrl || undefined;
                const co = companies?.find(c => c.id === inv.companyId);
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
                  const filename = `TaxInvoice_${inv.invoiceNumber ?? inv.id ?? "doc"}.pdf`;
                  const signatureUrl = user?.signatureUrl || undefined;
                  const co = companies?.find(c => c.id === inv.companyId);
                  const stampUrl = co?.stamp || undefined;
                  const stampWidthPct = co?.stampWidthPct ?? undefined;
                  const stampMarginPct = co?.stampMarginPct ?? undefined;
                  const { base64 } = await captureElementToPdfBase64(docEl, filename, { signatureUrl, stampUrl, stampWidthPct, stampMarginPct });
                  attachments = [{ filename, content: base64, contentType: "application/pdf", size: Math.round(base64.length * 0.75) }];
                } catch { /* fall through */ } finally { setGeneratingPdf(false); }
              }
              openCompose({
                toAddress: (inv as any).clientEmail ?? "",
                toName: inv.clientName ?? "",
                subject: `Tax Invoice ${inv.invoiceNumber ?? ""} – ${inv.clientName ?? ""}`,
                body: `Dear ${inv.clientName ?? "Sir/Madam"},\n\nPlease find attached Tax Invoice ${inv.invoiceNumber ?? ""} amounting to AED ${Number(inv.grandTotal ?? 0).toLocaleString()}.\n\nPayment Status: ${inv.paymentStatus ?? "unpaid"}\n\nKindly process the payment at your earliest convenience.\n\nBest regards,\nPrime Max Prefab`,
                clientName: inv.clientName ?? "",
                sourceRef: inv.invoiceNumber ?? "",
                companyId: inv.companyId ?? undefined,
                attachments,
              });
            }}
          >
            {generatingPdf ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Preparing PDF…</> : <><Mail className="w-4 h-4 mr-1" />Send Email</>}
          </Button>
          <ExportButtons docNumber={inv.invoiceNumber ?? inv.id?.toString() ?? "Invoice"} recipientPhone={(inv as any).clientPhone ?? undefined} recipientEmail={(inv as any).clientEmail ?? undefined} companyId={inv.companyId ?? undefined} docTypeLabel="Tax Invoice" signatureUrl={user?.signatureUrl ?? undefined} stampUrl={companies?.find(c => c.id === inv.companyId)?.stamp ?? undefined} stampWidthPct={companies?.find(c => c.id === inv.companyId)?.stampWidthPct ?? undefined} stampMarginPct={companies?.find(c => c.id === inv.companyId)?.stampMarginPct ?? undefined} />
        </div>
      </div>
      {canSignDocuments((user as any)?.permissionLevel) && (
        <SignatureStampPreview
          signatureUrl={user?.signatureUrl ?? undefined}
          stampUrl={companies?.find(c => c.id === inv.companyId)?.stamp ?? undefined}
        />
      )}
      <DocumentPrint data={docData} />
      {(inv as any)?.projectId && (
        <InvoiceProjectCost projectId={(inv as any).projectId} invoiceId={invId} />
      )}

      {/* Delete Confirmation */}
      <Dialog open={confirmDelete} onOpenChange={o => { if (!o) setConfirmDelete(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tax Invoice</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{inv.invoiceNumber}</strong>. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate({ id: invId })}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvoiceProjectCost({ projectId, invoiceId }: { projectId: number; invoiceId: number }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}api/projects/${projectId}/cost-summary`, {
      headers: authHeaders(), credentials: "include",
    })
      .then(r => r.ok ? r.json() : null)
      .then(j => alive && j && setData(j))
      .catch(() => {});
    return () => { alive = false; };
  }, [projectId]);

  if (!data) return null;

  const fmt = (n: number) => `AED ${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const profitColor = data.profit >= 0 ? "text-green-700" : "text-red-700";
  const thisInvoice = data.invoices?.find((i: any) => i.id === invoiceId);

  return (
    <Card className="no-print border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
          <BarChart2 className="w-4 h-4" />
          Project Profitability — {data.projectNumber}
          <Link href={`/projects/${projectId}`} className="ml-auto text-xs text-[#1e6ab0] underline underline-offset-2">View Project</Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <Kpi label="Quoted Value" value={fmt(data.projectValue)} />
          <Kpi label="Total Invoiced" value={fmt(data.revenue)} sub={`${fmt(data.collected)} collected`} />
          <Kpi label="Procurement Cost" value={fmt(data.procurementCost)} sub={`${data.purchaseOrders?.length ?? 0} PO(s)`} />
          <Kpi label="Other Expenses" value={fmt(data.expensesCost)} />
          <Kpi label="Project Profit" value={<span className={profitColor}>{fmt(data.profit)}</span>} sub={`${data.margin?.toFixed(1)}% margin`} />
        </div>
        {thisInvoice && (
          <p className="text-xs text-muted-foreground mt-3">
            This invoice contributes <strong>{fmt(thisInvoice.grandTotal ?? 0)}</strong> of project revenue · {thisInvoice.paymentStatus}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded border p-2.5 bg-slate-50">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-bold mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
