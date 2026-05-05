import { useEffect, useState } from "react";
import {
  useGetTaxInvoice,
  useUpdateTaxInvoice,
  getGetTaxInvoiceQueryKey,
  getListTaxInvoicesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Props { id: string }

interface FormState {
  clientName: string;
  clientTrn: string;
  companyTrn: string;
  invoiceDate: string;
  supplyDate: string;
  subtotal: number;
  vatPercent: number;
  vatAmount: number;
  grandTotal: number;
  amountPaid: number;
  paymentStatus: string;
  status: string;
  paymentTerms: string;
}

export function InvoiceEdit({ id }: Props) {
  const invId = parseInt(id, 10);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: inv, isLoading } = useGetTaxInvoice(invId, {
    query: { queryKey: getGetTaxInvoiceQueryKey(invId), enabled: !!invId },
  });

  const [form, setForm] = useState<FormState>({
    clientName: "", clientTrn: "", companyTrn: "",
    invoiceDate: "", supplyDate: "",
    subtotal: 0, vatPercent: 5, vatAmount: 0, grandTotal: 0,
    amountPaid: 0, paymentStatus: "unpaid", status: "active",
    paymentTerms: "",
  });

  useEffect(() => {
    if (!inv) return;
    setForm({
      clientName: inv.clientName ?? "",
      clientTrn: inv.clientTrn ?? "",
      companyTrn: (inv as any).companyTrn ?? "",
      invoiceDate: inv.invoiceDate ?? "",
      supplyDate: inv.supplyDate ?? "",
      subtotal: inv.subtotal ?? 0,
      vatPercent: inv.vatPercent ?? 5,
      vatAmount: inv.vatAmount ?? 0,
      grandTotal: inv.grandTotal ?? 0,
      amountPaid: (inv as any).amountPaid ?? 0,
      paymentStatus: inv.paymentStatus ?? "unpaid",
      status: (inv as any).status ?? "active",
      paymentTerms: (inv as any).paymentTerms ?? "",
    });
  }, [inv]);

  // Auto-recalc VAT and grand total when subtotal or VAT % change
  useEffect(() => {
    const vatAmount = +(form.subtotal * form.vatPercent / 100).toFixed(2);
    const grandTotal = +(form.subtotal + vatAmount).toFixed(2);
    setForm(p => (p.vatAmount === vatAmount && p.grandTotal === grandTotal ? p : { ...p, vatAmount, grandTotal }));
  }, [form.subtotal, form.vatPercent]);

  // Auto-derive payment status from amountPaid vs grandTotal
  useEffect(() => {
    const balance = form.grandTotal - form.amountPaid;
    const ps = balance <= 0 ? "paid" : form.amountPaid > 0 ? "partial" : "unpaid";
    setForm(p => (p.paymentStatus === ps ? p : { ...p, paymentStatus: ps }));
  }, [form.grandTotal, form.amountPaid]);

  const update = useUpdateTaxInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTaxInvoiceQueryKey(invId) });
        queryClient.invalidateQueries({ queryKey: getListTaxInvoicesQueryKey() });
        toast({ title: "Tax Invoice updated." });
        navigate("/accounts/invoices/" + invId);
      },
      onError: () => toast({ title: "Failed to update.", variant: "destructive" }),
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;
  if (!inv) return <div className="text-muted-foreground p-8">Tax Invoice not found.</div>;

  const handleSave = () => {
    if (!inv.companyId) return;
    update.mutate({
      id: invId,
      data: {
        companyId: inv.companyId,
        clientName: form.clientName,
        invoiceDate: form.invoiceDate || undefined,
        supplyDate: form.supplyDate || undefined,
        subtotal: form.subtotal,
        vatPercent: form.vatPercent,
        vatAmount: form.vatAmount,
        grandTotal: form.grandTotal,
        paymentStatus: form.paymentStatus,
        // Extra editable fields not in the typed body — server persists them via spread.
        ...({
          clientTrn: form.clientTrn || null,
          companyTrn: form.companyTrn || null,
          amountPaid: form.amountPaid,
          status: form.status,
          paymentTerms: form.paymentTerms || null,
        } as Record<string, unknown>),
      } as any,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/accounts/invoices/${invId}`}><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
        <h1 className="text-xl font-semibold">Edit Tax Invoice — {inv.invoiceNumber}</h1>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={update.isPending} className="bg-[#0f2d5a] hover:bg-[#1e6ab0]">
            <Save className="w-4 h-4 mr-1" />{update.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Client & Dates</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Client Name</Label>
            <Input value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Client TRN</Label>
            <Input value={form.clientTrn} onChange={e => setForm(p => ({ ...p, clientTrn: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Invoice Date</Label>
            <Input type="date" value={form.invoiceDate} onChange={e => setForm(p => ({ ...p, invoiceDate: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Supply Date</Label>
            <Input type="date" value={form.supplyDate} onChange={e => setForm(p => ({ ...p, supplyDate: e.target.value }))} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Payment Terms</Label>
            <Input
              value={form.paymentTerms}
              onChange={e => setForm(p => ({ ...p, paymentTerms: e.target.value }))}
              placeholder="e.g. 50% advance, 50% on delivery"
              data-testid="input-payment-terms"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Amounts</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label>Subtotal</Label>
            <Input type="number" value={form.subtotal} onChange={e => setForm(p => ({ ...p, subtotal: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div className="space-y-1">
            <Label>VAT %</Label>
            <Input type="number" value={form.vatPercent} onChange={e => setForm(p => ({ ...p, vatPercent: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div className="space-y-1">
            <Label>VAT Amount</Label>
            <Input type="number" value={form.vatAmount} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1">
            <Label>Grand Total</Label>
            <Input type="number" value={form.grandTotal} readOnly className="bg-muted font-semibold" />
          </div>
          <div className="space-y-1">
            <Label>Amount Paid</Label>
            <Input type="number" value={form.amountPaid} onChange={e => setForm(p => ({ ...p, amountPaid: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div className="space-y-1">
            <Label>Payment Status</Label>
            <Select value={form.paymentStatus} onValueChange={(v) => setForm(p => ({ ...p, paymentStatus: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
