import { useGetQuotation, useApproveQuotation } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft, Printer, Check, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetQuotationQueryKey } from "@workspace/api-client-react";
import { Separator } from "@/components/ui/separator";

interface Props { id: string }

export function QuotationDetail({ id }: Props) {
  const qid = parseInt(id, 10);
  const queryClient = useQueryClient();
  const { data: q, isLoading } = useGetQuotation(qid, { query: { enabled: !!qid } });
  const approve = useApproveQuotation({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(qid) }) } });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!q) return <div className="text-muted-foreground p-8">Quotation not found.</div>;

  const items = (q as any).items ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 no-print">
        <Button variant="ghost" size="sm" asChild><Link href="/sales/quotations"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link></Button>
        <div className="ml-auto flex gap-2">
          {q.status === "sent" && <>
            <Button variant="outline" className="text-green-600 border-green-600" onClick={() => approve.mutate({ id: qid })}><Check className="w-4 h-4 mr-1" />Approve</Button>
          </>}
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />Print</Button>
        </div>
      </div>

      <div className="bg-card border rounded-xl p-8 print:shadow-none print:border-none">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-primary">{(q as any).companyRef ?? "Prime Max Prefab Houses Industry LLC"}</h1>
            <p className="text-sm text-muted-foreground">Industrial Area 12, Sharjah, UAE | TRN: 100234567890001</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">QUOTATION</div>
            <div className="text-2xl font-mono font-bold text-primary">{q.quotationNumber}</div>
            <Badge variant="secondary" className="mt-1 capitalize">{q.status}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Bill To</h3>
            <div className="font-semibold">{q.clientName}</div>
            {q.clientEmail && <div className="text-sm text-muted-foreground">{q.clientEmail}</div>}
            {q.clientPhone && <div className="text-sm text-muted-foreground">{q.clientPhone}</div>}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Project Details</h3>
            {q.projectName && <div className="font-medium">{q.projectName}</div>}
            {q.projectLocation && <div className="text-sm text-muted-foreground">{q.projectLocation}</div>}
            {q.validity && <div className="text-sm mt-1">Validity: <span className="font-medium">{q.validity}</span></div>}
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold">#</th>
                <th className="text-left p-3 font-semibold">Description</th>
                <th className="text-right p-3 font-semibold">Qty</th>
                <th className="text-left p-3 font-semibold">Unit</th>
                <th className="text-right p-3 font-semibold">Rate (AED)</th>
                <th className="text-right p-3 font-semibold">Amount (AED)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, i: number) => (
                <tr key={item.id ?? i} className="border-t">
                  <td className="p-3 text-muted-foreground">{i + 1}</td>
                  <td className="p-3">{item.description}</td>
                  <td className="p-3 text-right">{item.quantity}</td>
                  <td className="p-3">{item.unit}</td>
                  <td className="p-3 text-right">{item.rate?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 text-right font-medium">{item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>AED {q.subtotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            {(q.discount ?? 0) > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount ({q.discount}%)</span><span className="text-red-500">-AED {((q.subtotal ?? 0) * (q.discount ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT ({q.vatPercent}%)</span><span>AED {q.vatAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <Separator />
            <div className="flex justify-between font-bold text-lg"><span>Grand Total</span><span className="text-primary">AED {q.grandTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          </div>
        </div>

        {q.paymentTerms && <div className="mt-6 p-4 bg-muted/30 rounded-lg text-sm"><strong>Payment Terms: </strong>{q.paymentTerms}</div>}
        {q.termsConditions && <div className="mt-3 p-4 bg-muted/30 rounded-lg text-sm"><strong>Terms & Conditions: </strong>{q.termsConditions}</div>}

        <div className="mt-10 pt-6 border-t flex justify-between text-sm text-muted-foreground">
          <div>Prepared by: <strong>{(q as any).preparedByName ?? "-"}</strong></div>
          <div>{q.approvedById && <>Approved by: <strong>{(q as any).approvedByName ?? "-"}</strong></>}</div>
        </div>
      </div>
    </div>
  );
}
