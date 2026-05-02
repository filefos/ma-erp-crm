import {
  useGetTaxInvoice, useGetQuotation,
  getGetTaxInvoiceQueryKey, getGetQuotationQueryKey,
  useCreateDeliveryNote,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Package } from "lucide-react";
import { ExportButtons } from "@/components/export-buttons";
import { DocumentPrint } from "@/components/document-print";
import type { DocumentData } from "@/components/document-print";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface Props { id: string }

const PAYMENT_COLORS: Record<string, string> = {
  unpaid: "bg-red-100 text-red-800",
  partial: "bg-amber-100 text-amber-800",
  paid: "bg-green-100 text-green-800",
};

export function InvoiceDetail({ id }: Props) {
  const invId = parseInt(id, 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [converting, setConverting] = useState(false);

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

  const docData: DocumentData = {
    type: "tax_invoice",
    docNumber: inv.invoiceNumber,
    companyId: inv.companyId,
    companyRef: (inv as any).companyRef,
    clientName: inv.clientName,
    clientTrn: inv.clientTrn,
    invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : undefined,
    supplyDate: inv.supplyDate ? new Date(inv.supplyDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : undefined,
    subtotal: inv.subtotal,
    vatPercent: inv.vatPercent ?? 5,
    vatAmount: inv.vatAmount,
    grandTotal: inv.grandTotal,
    items: qItems.map(i => ({
      description: i.description,
      sizeStatus: i.unit,
      quantity: i.quantity,
      total: i.amount,
    })),
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
        <div className="ml-auto flex gap-2">
          <Button
            size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
            onClick={handleCreateDN} disabled={converting}
          >
            <Package className="w-4 h-4 mr-1" />{converting ? "Creating…" : "Create Delivery Note"}
          </Button>
          <ExportButtons docNumber={inv.invoiceNumber ?? inv.id?.toString() ?? "Invoice"} />
        </div>
      </div>
      <DocumentPrint data={docData} />
    </div>
  );
}
