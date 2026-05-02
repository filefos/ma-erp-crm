import {
  useGetProformaInvoice, useGetQuotation,
  getGetProformaInvoiceQueryKey, getGetQuotationQueryKey,
  useCreateTaxInvoice,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer, Receipt } from "lucide-react";
import { DocumentPrint } from "@/components/document-print";
import type { DocumentData } from "@/components/document-print";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface Props { id: string }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
};

export function ProformaInvoiceDetail({ id }: Props) {
  const pid = parseInt(id, 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [converting, setConverting] = useState(false);

  const { data: pi, isLoading } = useGetProformaInvoice(pid, {
    query: { queryKey: getGetProformaInvoiceQueryKey(pid), enabled: !!pid },
  });

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

  const qItems = ((quotation as any)?.items ?? []) as {
    description: string; unit?: string; rate?: number; quantity: number; amount?: number;
  }[];

  const subtotal = pi.subtotal ?? (pi.total - (pi.vatAmount ?? 0));

  const docData: DocumentData = {
    type: "proforma",
    docNumber: pi.piNumber,
    companyId: pi.companyId,
    companyRef: (pi as any).companyRef,
    clientName: pi.clientName,
    projectName: pi.projectName,
    date: pi.createdAt ? new Date(pi.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : undefined,
    validity: pi.validityDate,
    subtotal,
    vatPercent: 5,
    vatAmount: pi.vatAmount,
    grandTotal: pi.total,
    paymentTerms: pi.paymentTerms,
    items: qItems.map(i => ({
      description: i.description,
      sizeStatus: i.unit,
      unitPrice: i.rate,
      quantity: i.quantity,
      total: i.amount,
    })),
    preparedByName: (pi as any).preparedByName,
  };

  const handleConvertToTax = () => {
    if (converting) return;
    setConverting(true);
    const today = new Date().toISOString().split("T")[0];
    createTax.mutate({ data: {
      companyId: pi.companyId,
      clientName: pi.clientName,
      quotationId: qid,
      invoiceDate: today,
      supplyDate: today,
      subtotal,
      vatPercent: 5,
      vatAmount: pi.vatAmount,
      grandTotal: pi.total,
      paymentStatus: "unpaid",
    } });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="no-print flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sales/proforma-invoices"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
        <Badge className={`capitalize ${STATUS_COLORS[pi.status] ?? "bg-gray-100"}`}>{pi.status}</Badge>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
            onClick={handleConvertToTax} disabled={converting}
          >
            <Receipt className="w-4 h-4 mr-1" />{converting ? "Creating…" : "Convert to Tax Invoice"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" />Print / PDF
          </Button>
        </div>
      </div>
      <DocumentPrint data={docData} />
    </div>
  );
}
