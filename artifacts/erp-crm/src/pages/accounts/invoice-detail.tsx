import {
  useGetTaxInvoice, useGetQuotation,
  getGetTaxInvoiceQueryKey, getGetQuotationQueryKey,
  useCreateDeliveryNote,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Package, Pencil, FileText, BookOpen } from "lucide-react";
import { ExportButtons } from "@/components/export-buttons";
import { DocumentPrint } from "@/components/document-print";
import type { DocumentData } from "@/components/document-print";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authHeaders } from "@/lib/ai-client";

interface Props { id: string }

const PAYMENT_COLORS: Record<string, string> = {
  unpaid: "bg-red-100 text-red-800",
  partial: "bg-orange-100 text-orange-800",
  paid: "bg-green-100 text-green-800",
};

export function InvoiceDetail({ id }: Props) {
  const invId = parseInt(id, 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [converting, setConverting] = useState(false);
  const [creatingJournal, setCreatingJournal] = useState(false);

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

  const docData: DocumentData = {
    type: "tax_invoice",
    docNumber: inv.invoiceNumber,
    companyId: inv.companyId,
    companyRef: (inv as any).companyRef,
    clientName: inv.clientName,
    clientTrn: inv.clientTrn,
    companyTrn: (inv as any).companyTrn ?? undefined,
    invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : undefined,
    supplyDate: inv.supplyDate ? new Date(inv.supplyDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : undefined,
    subtotal: inv.subtotal,
    vatPercent: inv.vatPercent ?? 5,
    vatAmount: inv.vatAmount,
    grandTotal: inv.grandTotal,
    paymentTerms: (inv as any).paymentTerms ?? undefined,
    items: sourceItems.map((i: any) => ({
      description: i.description,
      sizeStatus: i.unit ?? i.sizeStatus,
      unitPrice: i.rate ?? i.unitPrice,
      quantity: i.quantity ?? 1,
      total: i.amount ?? i.total,
      vatPercent: i.vatPercent,
    })),
    printedByUniqueId: (user as any)?.uniqueUserId ?? undefined,
    clientCode: (inv as any).clientCode ?? undefined,
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
        <Badge className={`capitalize ${PAYMENT_COLORS[inv.paymentStatus] ?? "bg-gray-100"}`}>
          {inv.paymentStatus}
        </Badge>
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
            <Link href={`/accounts/invoices/${invId}/edit`}>
              <Pencil className="w-4 h-4 mr-1" />Edit
            </Link>
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={handleAutoJournal} disabled={creatingJournal}
            data-testid="button-auto-journal"
          >
            <BookOpen className="w-4 h-4 mr-1" />{creatingJournal ? "Creating…" : "Suggest Journal Entry"}
          </Button>
          <Button
            size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
            onClick={handleCreateDN} disabled={converting}
          >
            <Package className="w-4 h-4 mr-1" />{converting ? "Creating…" : "Create Delivery Note"}
          </Button>
          <ExportButtons docNumber={inv.invoiceNumber ?? inv.id?.toString() ?? "Invoice"} recipientPhone={(inv as any).clientPhone ?? undefined} recipientEmail={(inv as any).clientEmail ?? undefined} companyId={inv.companyId ?? undefined} docTypeLabel="Tax Invoice" />
        </div>
      </div>
      <DocumentPrint data={docData} />
    </div>
  );
}
