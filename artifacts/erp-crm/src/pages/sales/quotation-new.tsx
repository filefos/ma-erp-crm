import { useState } from "react";
import { useCreateQuotation, useListCompanies } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListQuotationsQueryKey } from "@workspace/api-client-react";

interface Item { description: string; quantity: number; unit: string; rate: number; amount: number; discount: number; }

const emptyItem = (): Item => ({ description: "", quantity: 1, unit: "nos", rate: 0, amount: 0, discount: 0 });

export function QuotationNew() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: companies } = useListCompanies();
  const create = useCreateQuotation({ mutation: { onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() }); navigate(`/sales/quotations/${data.id}`); } } });

  const [form, setForm] = useState({ companyId: "", clientName: "", clientEmail: "", clientPhone: "", projectName: "", projectLocation: "", status: "draft", vatPercent: 5, discount: 0, paymentTerms: "", validity: "30 days", termsConditions: "" });
  const [items, setItems] = useState<Item[]>([emptyItem()]);

  const updateItem = (i: number, field: keyof Item, val: string | number) => {
    setItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      const qty = field === "quantity" ? Number(val) : next[i].quantity;
      const rate = field === "rate" ? Number(val) : next[i].rate;
      const disc = field === "discount" ? Number(val) : next[i].discount;
      next[i].amount = qty * rate * (1 - disc / 100);
      return next;
    });
  };

  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const discountedSubtotal = subtotal * (1 - form.discount / 100);
  const vatAmount = discountedSubtotal * form.vatPercent / 100;
  const grandTotal = discountedSubtotal + vatAmount;

  const handleSubmit = () => {
    if (!form.companyId || !form.clientName) return;
    create.mutate({ data: { ...form, companyId: parseInt(form.companyId, 10), items } as any });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild><Link href="/sales/quotations"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link></Button>
        <h1 className="text-2xl font-bold tracking-tight">New Quotation</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Client Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <Label>Company *</Label>
            <Select value={form.companyId} onValueChange={v => setForm(p => ({...p, companyId: v}))}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>{companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Client Name *</Label><Input value={form.clientName} onChange={e => setForm(p => ({...p, clientName: e.target.value}))} /></div>
          <div className="space-y-1"><Label>Client Email</Label><Input type="email" value={form.clientEmail} onChange={e => setForm(p => ({...p, clientEmail: e.target.value}))} /></div>
          <div className="space-y-1"><Label>Client Phone</Label><Input value={form.clientPhone} onChange={e => setForm(p => ({...p, clientPhone: e.target.value}))} /></div>
          <div className="space-y-1"><Label>Project Name</Label><Input value={form.projectName} onChange={e => setForm(p => ({...p, projectName: e.target.value}))} /></div>
          <div className="space-y-1"><Label>Project Location</Label><Input value={form.projectLocation} onChange={e => setForm(p => ({...p, projectLocation: e.target.value}))} /></div>
          <div className="space-y-1"><Label>Validity</Label><Input value={form.validity} onChange={e => setForm(p => ({...p, validity: e.target.value}))} /></div>
          <div className="space-y-1"><Label>Payment Terms</Label><Input value={form.paymentTerms} onChange={e => setForm(p => ({...p, paymentTerms: e.target.value}))} /></div>
          <div className="space-y-1 col-span-2"><Label>Terms & Conditions</Label><Textarea value={form.termsConditions} onChange={e => setForm(p => ({...p, termsConditions: e.target.value}))} rows={3} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line Items</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setItems(p => [...p, emptyItem()])}><Plus className="w-4 h-4 mr-1" />Add Row</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-left pb-2 font-semibold">Description</th>
                <th className="text-right pb-2 font-semibold w-20">Qty</th>
                <th className="text-left pb-2 font-semibold w-20 pl-2">Unit</th>
                <th className="text-right pb-2 font-semibold w-28">Rate</th>
                <th className="text-right pb-2 font-semibold w-24">Disc%</th>
                <th className="text-right pb-2 font-semibold w-32">Amount</th>
                <th className="w-8"></th>
              </tr></thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1 pr-2"><Input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} className="h-8" /></td>
                    <td className="py-1 px-1"><Input type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="h-8 text-right w-full" /></td>
                    <td className="py-1 px-1"><Input value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} className="h-8" /></td>
                    <td className="py-1 px-1"><Input type="number" value={item.rate} onChange={e => updateItem(i, "rate", e.target.value)} className="h-8 text-right w-full" /></td>
                    <td className="py-1 px-1"><Input type="number" value={item.discount} onChange={e => updateItem(i, "discount", e.target.value)} className="h-8 text-right w-full" /></td>
                    <td className="py-1 pl-1 text-right font-medium">AED {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-1 pl-1">
                      {items.length > 1 && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItems(p => p.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-72 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>AED {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Discount (%)</span>
                <Input type="number" className="w-20 h-7 text-right text-sm" value={form.discount} onChange={e => setForm(p => ({...p, discount: parseFloat(e.target.value) || 0}))} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">VAT (%)</span>
                <Input type="number" className="w-20 h-7 text-right text-sm" value={form.vatPercent} onChange={e => setForm(p => ({...p, vatPercent: parseFloat(e.target.value) || 5}))} />
              </div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT Amount</span><span>AED {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span>Grand Total</span><span className="text-primary">AED {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" asChild><Link href="/sales/quotations">Cancel</Link></Button>
        <Button variant="outline" onClick={() => { setForm(p => ({...p, status: "draft"})); handleSubmit(); }} disabled={create.isPending || !form.companyId || !form.clientName}>Save as Draft</Button>
        <Button onClick={() => { setForm(p => ({...p, status: "sent"})); handleSubmit(); }} disabled={create.isPending || !form.companyId || !form.clientName}>
          {create.isPending ? "Creating..." : "Create & Send"}
        </Button>
      </div>
    </div>
  );
}
