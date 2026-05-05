import { useState } from "react";
import { useListPaymentsMade, useCreatePaymentMade, useUpdatePaymentMade, useDeletePaymentMade, useListCompanies, useListBankAccounts } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyField } from "@/components/CompanyField";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, ArrowUpCircle, BookOpen } from "lucide-react";
import { authHeaders } from "@/lib/ai-client";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";
import { AccountsPageHeader, AccountsStat, AccountsStatStrip } from "@/components/accounts-page-header";

const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "card", "online"];
const methodLabels: Record<string, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer", cheque: "Cheque", card: "Card", online: "Online",
};

type FormData = {
  companyId: string; payeeName: string; expenseRef: string; paymentDate: string;
  amount: string; paymentMethod: string; bankAccountId: string; referenceNumber: string; notes: string; status: string;
};

const EMPTY: FormData = {
  companyId: "", payeeName: "", expenseRef: "", paymentDate: new Date().toISOString().split("T")[0],
  amount: "", paymentMethod: "bank_transfer", bankAccountId: "", referenceNumber: "", notes: "", status: "completed",
};

export function PaymentsMadeList() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [pendingJournalId, setPendingJournalId] = useState<number | null>(null);

  const handleJournal = async (paymentId: number) => {
    if (pendingJournalId) return;
    setPendingJournalId(paymentId);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/journal-entries/auto-from-source`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceType: "payment_made", sourceId: paymentId }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({ title: "Draft journal created", description: `${(j as any).journalNumber} — review in Journal Entries.` });
      } else {
        toast({ title: (j as any).message ?? "Failed to create journal", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setPendingJournalId(null);
    }
  };

  const { data: payments = [], isLoading } = useListPaymentsMade();
  const { data: companies = [] } = useListCompanies();
  const { data: bankAccounts = [] } = useListBankAccounts();
  const { filterByCompany } = useActiveCompany();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/payments-made"] });
  const createMutation = useCreatePaymentMade({ mutation: { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Payment recorded." }); }, onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }) } });
  const updateMutation = useUpdatePaymentMade({ mutation: { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Payment updated." }); }, onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }) } });
  const deleteMutation = useDeletePaymentMade({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Deleted." }); } } });

  const filtered = filterByCompany(payments).filter(p =>
    !search || p.payeeName.toLowerCase().includes(search.toLowerCase()) || p.paymentNumber.toLowerCase().includes(search.toLowerCase()) || (p.expenseRef ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalMade = filtered.reduce((s, p) => s + (p.amount ?? 0), 0);

  const openCreate = () => { setEditId(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({ companyId: String(p.companyId), payeeName: p.payeeName, expenseRef: p.expenseRef ?? "", paymentDate: p.paymentDate, amount: String(p.amount), paymentMethod: p.paymentMethod, bankAccountId: String(p.bankAccountId ?? ""), referenceNumber: p.referenceNumber ?? "", notes: p.notes ?? "", status: p.status });
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
      <AccountsPageHeader
        title="Payments Made"
        subtitle="Track all outgoing payments to suppliers and vendors."
        right={
          <>
            <ExportMenu
              data={filtered}
              columns={[
                { header: "Payment No.", key: "paymentNumber" },
                { header: "Payee", key: "payeeName" },
                { header: "Expense Ref", key: "expenseRef" },
                { header: "Date", key: "paymentDate" },
                { header: "Amount (AED)", key: "amount", format: v => Number(v ?? 0).toFixed(2) },
                { header: "Method", key: "paymentMethod" },
                { header: "Reference", key: "referenceNumber" },
              ]}
              filename="payments-made"
              title="Payments Made"
              size="sm"
            />
            <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />Record Payment
            </Button>
          </>
        }
      />

      <AccountsStatStrip>
        <AccountsStat label="Total Paid Out (Filtered)" tone="bad" value={`AED ${totalMade.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
        <AccountsStat label="Records" value={filtered.length} />
      </AccountsStatStrip>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by payee, expense ref, payment no..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment No.</TableHead>
              <TableHead>Payee</TableHead>
              <TableHead>Expense Ref</TableHead>
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
                  <ArrowUpCircle className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No payments recorded yet.</p>
                </TableCell>
              </TableRow>
            ) : filtered.map(p => (
              <TableRow key={p.id} className="hover:bg-muted/40">
                <TableCell className="font-mono text-sm font-medium text-primary">{p.paymentNumber}</TableCell>
                <TableCell className="font-medium">{p.payeeName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.expenseRef || "-"}</TableCell>
                <TableCell>{p.paymentDate}</TableCell>
                <TableCell className="text-sm">{methodLabels[p.paymentMethod] ?? p.paymentMethod}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{(p as any).referenceNumber || "-"}</TableCell>
                <TableCell className="text-right font-semibold text-red-700">AED {(p.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-red-100 text-red-800">{p.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-[#0f2d5a] hover:text-[#1e6ab0]" title="Suggest Journal Entry" disabled={pendingJournalId === p.id} onClick={() => handleJournal(p.id)}><BookOpen className="w-3.5 h-3.5" /></Button>
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
          <DialogHeader><DialogTitle>{editId ? "Edit Payment" : "Record Payment Made"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1 col-span-2">
              <Label>Company *</Label>
              <CompanyField value={form.companyId} onChange={v => setForm(p => ({ ...p, companyId: v }))} />
            </div>
            <div className="space-y-1 col-span-2"><Label>Payee Name *</Label><Input value={form.payeeName} onChange={f("payeeName")} placeholder="Supplier / vendor name" /></div>
            <div className="space-y-1"><Label>Expense / Bill Ref</Label><Input value={form.expenseRef} onChange={f("expenseRef")} placeholder="EXP-2026-00001" /></div>
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
              <Select value={form.bankAccountId || "__none__"} onValueChange={v => setForm(p => ({ ...p, bankAccountId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {bankAccounts.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} — {b.accountNumber}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2"><Label>Reference / Transaction No.</Label><Input value={form.referenceNumber} onChange={f("referenceNumber")} placeholder="TXN / cheque number" /></div>
            <div className="space-y-1 col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={f("notes")} rows={2} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={handleSave} disabled={!form.companyId || !form.payeeName || !form.amount || !form.paymentDate || createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editId ? "Update" : "Save Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
