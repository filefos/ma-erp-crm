import { useState } from "react";
import {
  useGetQuotation, useApproveQuotation, useCreateProformaInvoice,
  useCreateTaxInvoice, useCreateDeliveryNote,
  getGetQuotationQueryKey, useListCompanies,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, FileText, Receipt, Package, ChevronDown } from "lucide-react";
import { ExportButtons } from "@/components/export-buttons";
import { DocumentPrint } from "@/components/document-print";
import type { DocumentData } from "@/components/document-print";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface Props { id: string }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export function QuotationDetail({ id }: Props) {
  const qid = parseInt(id, 10);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [converting, setConverting] = useState<string | null>(null);

  const { data: q, isLoading } = useGetQuotation(qid, {
    query: { queryKey: getGetQuotationQueryKey(qid), enabled: !!qid },
  });
  const { data: companies } = useListCompanies();

  const approve = useApproveQuotation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(qid) });
        toast({ title: "Quotation approved." });
      },
    },
  });

  const createPI = useCreateProformaInvoice({
    mutation: {
      onSuccess: (pi) => {
        toast({ title: "Proforma Invoice created!", description: `${pi.piNumber}` });
        navigate("/sales/proforma-invoices/" + pi.id);
      },
      onError: () => toast({ title: "Failed to create Proforma Invoice.", variant: "destructive" }),
      onSettled: () => setConverting(null),
    },
  });

  const createTax = useCreateTaxInvoice({
    mutation: {
      onSuccess: (inv) => {
        toast({ title: "Tax Invoice created!", description: `${inv.invoiceNumber}` });
        navigate("/accounts/invoices/" + inv.id);
      },
      onError: () => toast({ title: "Failed to create Tax Invoice.", variant: "destructive" }),
      onSettled: () => setConverting(null),
    },
  });

  const createDN = useCreateDeliveryNote({
    mutation: {
      onSuccess: (dn) => {
        toast({ title: "Delivery Note created!", description: `${dn.dnNumber}` });
        navigate("/accounts/delivery-notes/" + dn.id);
      },
      onError: () => toast({ title: "Failed to create Delivery Note.", variant: "destructive" }),
      onSettled: () => setConverting(null),
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;
  if (!q) return <div className="text-muted-foreground p-8">Quotation not found.</div>;

  const items = ((q as any).items ?? []) as {
    description: string; unit?: string; rate?: number; quantity: number; amount?: number;
  }[];

  let additionalItems: import("@/components/document-print").AdditionalCommercialItem[] | undefined;
  try {
    const raw = (q as any).additionalItems;
    if (raw) additionalItems = JSON.parse(raw);
  } catch { /* use default */ }

  const docData: DocumentData = {
    type: "quotation",
    docNumber: q.quotationNumber,
    companyId: q.companyId,
    companyRef: (q as any).companyRef,
    companyLogo: (companies?.find(c => c.id === q.companyId) as any)?.logo ?? undefined,
    clientName: q.clientName,
    clientContactPerson: (q as any).clientContactPerson,
    clientPhone: q.clientPhone,
    clientEmail: q.clientEmail,
    customerTrn: (q as any).customerTrn,
    projectName: q.projectName,
    projectLocation: q.projectLocation,
    date: q.createdAt ? new Date(q.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : undefined,
    validity: q.validity,
    vatPercent: q.vatPercent ?? 5,
    subtotal: q.subtotal,
    discount: q.discount,
    vatAmount: q.vatAmount,
    grandTotal: q.grandTotal,
    paymentTerms: q.paymentTerms,
    termsConditions: q.termsConditions,
    techSpecs: (q as any).techSpecs,
    additionalItems,
    items: items.map(i => ({
      description: i.description,
      sizeStatus: i.unit,
      unitPrice: i.rate,
      quantity: i.quantity,
      total: i.amount,
    })),
    preparedByName: (q as any).preparedByName,
  };

  const handleConvertToPI = () => {
    if (converting) return;
    setConverting("pi");
    createPI.mutate({ data: {
      companyId: q.companyId,
      clientName: q.clientName,
      projectName: q.projectName,
      quotationId: q.id,
      subtotal: q.subtotal,
      vatAmount: q.vatAmount,
      total: q.grandTotal,
      paymentTerms: q.paymentTerms,
      validityDate: q.validity,
    } });
  };

  const handleConvertToTax = () => {
    if (converting) return;
    setConverting("tax");
    const today = new Date().toISOString().split("T")[0];
    createTax.mutate({ data: {
      companyId: q.companyId,
      clientName: q.clientName,
      quotationId: q.id,
      invoiceDate: today,
      supplyDate: today,
      subtotal: q.subtotal,
      vatPercent: q.vatPercent ?? 5,
      vatAmount: q.vatAmount,
      grandTotal: q.grandTotal,
      paymentStatus: "unpaid",
    } });
  };

  const handleConvertToDN = () => {
    if (converting) return;
    setConverting("dn");
    createDN.mutate({ data: {
      companyId: q.companyId,
      clientName: q.clientName,
      projectName: q.projectName,
      deliveryDate: new Date().toISOString().split("T")[0],
      items: items.map(i => ({
        description: i.description,
        quantity: i.quantity,
        unit: i.unit ?? "nos",
      })),
    } });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Action Bar */}
      <div className="no-print flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sales/quotations"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
        <Badge className={`capitalize ${STATUS_COLORS[q.status] ?? "bg-gray-100"}`}>{q.status}</Badge>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {q.status === "sent" && (
            <Button
              size="sm" variant="outline"
              className="text-green-600 border-green-600"
              onClick={() => approve.mutate({ id: qid })}
              disabled={approve.isPending}
            >
              <Check className="w-4 h-4 mr-1" />{approve.isPending ? "Approving…" : "Approve"}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" disabled={!!converting}>
                {converting ? "Creating…" : "Convert To"}
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleConvertToPI}>
                <FileText className="w-4 h-4 mr-2 text-blue-600" />Proforma Invoice
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleConvertToTax}>
                <Receipt className="w-4 h-4 mr-2 text-green-600" />Tax Invoice
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleConvertToDN}>
                <Package className="w-4 h-4 mr-2 text-purple-600" />Delivery Note
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ExportButtons docNumber={q.quotationNumber ?? q.id?.toString() ?? "Quotation"} />
        </div>
      </div>

      {/* Document */}
      <DocumentPrint data={docData} />
    </div>
  );
}
