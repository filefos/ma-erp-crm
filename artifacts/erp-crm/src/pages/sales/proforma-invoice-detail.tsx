import {
  useGetProformaInvoice, useGetQuotation,
  getGetProformaInvoiceQueryKey, getGetQuotationQueryKey,
  useCreateTaxInvoice, useListCompanies,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Receipt, Pencil } from "lucide-react";
import { ExportButtons } from "@/components/export-buttons";
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
    projectName: pi.projectName,
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
  };

  const handleConvertToTax = () => {
    if (converting) return;
    setConverting(true);
    const today = new Date().toISOString().split("T")[0];
    createTax.mutate({ data: {
      companyId: pi.companyId,
      clientName: pi.clientName,
      clientEmail: (pi as any).clientEmail,
      clientPhone: (pi as any).clientPhone,
      projectName: pi.projectName,
      quotationId: qid,
      invoiceDate: today,
      supplyDate: today,
      subtotal,
      vatPercent,
      vatAmount,
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
          <ExportButtons docNumber={pi.piNumber ?? pi.id?.toString() ?? "PI"} />
        </div>
      </div>
      <DocumentPrint data={docData} />
    </div>
  );
}
