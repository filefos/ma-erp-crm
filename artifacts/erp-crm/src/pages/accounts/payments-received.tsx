import { useState } from "react";
import { useListPaymentsReceived, useCreatePaymentReceived, useUpdatePaymentReceived, useDeletePaymentReceived, useListCompanies, useListBankAccounts } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, ArrowDownCircle } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";

const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "card", "online"];

const methodLabels: Record<string, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer", cheque: "Cheque", card: "Card", online: "Online",
};

type FormData = {
  companyId: string; customerName: string; invoiceRef: string; paymentDate: string;
  amount: string; paymentMethod: string; bankAccountId: string; referenceNumber: string; notes: string; status: string;
};

const EMPTY: FormData = {
  companyId: "", customerName: "", invoiceRef: "", paymentDate: new Date().toISOString().split("T")[0],
  amount: "", paymentMethod: "bank_transfer", bankAccountId: "", referenceNumber: "", notes: "", status: "completed",
};

export function PaymentsReceivedList() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);

  const { data: payments = [], isLoading } = useListPaymentsReceived();
  const { data: companies = [] } = useListCompanies();
  const { data: bankAccounts = [] } = useListBankAccounts();
  const { filterByCompany } = useActiveCompany();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/payments-received"] });
  const createMutation = useCreatePaymentReceived({ mutation: { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Payment recorded." }); }, onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }) } });
  const updateMutation = useUpdatePaymentReceived({ mutation: { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Payment updated." }); }, onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }) } });
  const deleteMutation = useDeletePaymentReceived({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Payment deleted." }); } } });

  const filtered = filterByCompany(payments).filter(p =>
    !search || p.customerName.toLowerCase().includes(search.toLowerCase()) || p.paymentNumber.toLowerCase().includes(search.toLowerCase()) || (p.invoiceRef ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalReceived = filtered.reduce((s, p) => s + (p.amount ?? 0), 0);

  const openCreate = () => { setEditId(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({ companyId: String(p.companyId), customerName: p.customerName, invoiceRef: p.invoiceRef ?? "", paymentDate: p.paymentDate, amount: String(p.amount), paymentMethod: p.paymentMethod, bankAccountId: String(p.bankAccountId ?? ""), referenceNumber: p.referenceNumber ?? "", notes: p.notes ?? "", status: p.status });
    setOpen(true);
  };

  const handleSave = () => {
    const payload = { ...form, companyId: parseInt(form.companyId, 10), amount: parseFloat(form.amount) || 0, bankAccountId: form.bankAccountId ? parseInt(form.bankAccountId, 10) : undefined };
    if (editId) updateMutation.mutate({ id: editId, data: payload as any });
    else createMutation.mutate({ data: payload as any });
  };

  const f = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments Received</h1>
          <p className="text-muted-foreground">Record payments collected from customers.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={filtered as Record<string, unknown>[]}
            columns={[
              { header: "Payment No.", key: "paymentNumber" },
              { header: "Customer", key: "customerName" },
              { header: "Invoice Ref", key: "invoiceRef" },
              { header: "Date", key: "paymentDate" },
              { header: "Amount (AED)", key: "amount", format: v => Number(v ?? 0).toFixed(2) },
              { header: "Method", key: "paymentMethod" },
              { header: "Reference", key: "referenceNumber" },
            ]}
            filename="payments-received"
            title="Payments Received"
            size="sm"
          />
          <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />Record Payment
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-xs text-green-700 font-medium uppercase tracking-wide">Total Received (Filtered)</div>
          <div className="text-2xl font-bold text-green-800 mt-1">AED {totalReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Records</div>
          <div className="text-2xl font-bold mt-1">{filtered.length}</div>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by customer, invoice, payment no..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment No.</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Invoice Ref</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount (AED)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <ArrowDownCircle className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No payments received yet.</p>
                </TableCell>
              </TableRow>
            ) : filtered.map(p => (
              <TableRow key={p.id} className="hover:bg-muted/40">
                <TableCell className="font-mono text-sm font-medium text-primary">{p.paymentNumber}</TableCell>
                <TableCell className="font-medium">{p.customerName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.invoiceRef || "-"}</TableCell>
                <TableCell>{p.paymentDate}</TableCell>
                <TableCell className="text-sm">{methodLabels[p.paymentMethod] ?? p.paymentMethod}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{(p as any).referenceNumber || "-"}</TableCell>
                <TableCell className="text-right font-semibold text-green-700">AED {(p.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">{p.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => { if (confirm("Delete?")) deleteMutation.mutate({ id: p.id }); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Payment" : "Record Payment Received"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1 col-span-2">
              <Label>Company *</Label>
              <Select value={form.companyId} onValueChange={v => setForm(p => ({ ...p, companyId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2"><Label>Customer Name *</Label><Input value={form.customerName} onChange={f("customerName")} placeholder="Customer / company name" /></div>
            <div className="space-y-1"><Label>Invoice Reference</Label><Input value={form.invoiceRef} onChange={f("invoiceRef")} placeholder="INV-2026-00001" /></div>
            <div className="space-y-1"><Label>Payment Date *</Label><Input type="date" value={form.paymentDate} onChange={f("paymentDate")} /></div>
            <div className="space-y-1"><Label>Amount (AED) *</Label><Input type="number" value={form.amount} onChange={f("amount")} placeholder="0.00" /></div>
            <div className="space-y-1">
              <Label>Payment Method *</Label>
              <Select value={form.paymentMethod} onValueChange={v => setForm(p => ({ ...p, paymentMethod: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{methodLabels[m]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Bank Account</Label>
              <Select value={form.bankAccountId} onValueChange={v => setForm(p => ({ ...p, bankAccountId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {bankAccounts.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} — {b.accountNumber}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2"><Label>Reference / Transaction No.</Label><Input value={form.referenceNumber} onChange={f("referenceNumber")} placeholder="TXN / cheque number" /></div>
            <div className="space-y-1 col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={f("notes")} rows={2} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={handleSave} disabled={!form.companyId || !form.customerName || !form.amount || !form.paymentDate || createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editId ? "Update" : "Save Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
