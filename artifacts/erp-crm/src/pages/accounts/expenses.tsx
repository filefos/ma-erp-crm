import { useState } from "react";
import { useListExpenses, useCreateExpense } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyField } from "@/components/CompanyField";
import { Plus, Search, BookOpen } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";
import { getListExpensesQueryKey } from "@workspace/api-client-react";
import { AccountsPageHeader } from "@/components/accounts-page-header";
import { useToast } from "@/hooks/use-toast";
import { authHeaders } from "@/lib/ai-client";

const CATEGORIES = ["office","transport","utilities","material","labour","equipment","maintenance","travel","meals","other"];
const statusColors: Record<string, string> = {
  pending: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function ExpensesList() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "office", description: "", amount: "", vatAmount: "0", paymentMethod: "cash", paymentDate: "", companyId: "" });
  const [pendingJournalId, setPendingJournalId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: expenses, isLoading } = useListExpenses();
  const create = useCreateExpense({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() }); setOpen(false); } } });

  const handleJournal = async (expenseId: number) => {
    if (pendingJournalId) return;
    setPendingJournalId(expenseId);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/journal-entries/auto-from-source`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceType: "expense", sourceId: expenseId }),
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

  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(expenses ?? []).filter(e => !search || e.category.toLowerCase().includes(search.toLowerCase()) || e.description?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <AccountsPageHeader
        title="Expenses"
        subtitle="Track and manage all company expenses."
        right={
          <>
            <ExportMenu
              data={(expenses ?? [])}
              columns={[
                { header: "Category", key: "category" },
                { header: "Description", key: "description" },
                { header: "Amount (AED)", key: "amount", format: v => Number(v ?? 0).toFixed(2) },
                { header: "VAT (AED)", key: "vatAmount", format: v => Number(v ?? 0).toFixed(2) },
                { header: "Total (AED)", key: "total", format: v => Number(v ?? 0).toFixed(2) },
                { header: "Payment Method", key: "paymentMethod" },
                { header: "Payment Date", key: "paymentDate" },
                { header: "Status", key: "status" },
              ]}
              filename="expenses"
              title="Expenses"
              size="sm"
            />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Plus className="w-4 h-4 mr-2" />Add Expense</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Expense</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Company *</Label>
                  <CompanyField value={form.companyId} onChange={v => setForm(p => ({...p, companyId: v}))} />
                </div>
                <div className="space-y-1"><Label>Category *</Label>
                  <Select value={form.category} onValueChange={v => setForm(p => ({...p, category: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Amount (AED) *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} /></div>
                <div className="space-y-1"><Label>VAT Amount</Label><Input type="number" value={form.vatAmount} onChange={e => setForm(p => ({...p, vatAmount: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Payment Method</Label>
                  <Select value={form.paymentMethod} onValueChange={v => setForm(p => ({...p, paymentMethod: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Payment Date</Label><Input type="date" value={form.paymentDate} onChange={e => setForm(p => ({...p, paymentDate: e.target.value}))} /></div>
              </div>
              <div className="space-y-1"><Label>Description</Label><Input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} /></div>
              <Button onClick={() => create.mutate({ data: { ...form, companyId: parseInt(form.companyId,10), amount: parseFloat(form.amount)||0, vatAmount: parseFloat(form.vatAmount)||0, total: (parseFloat(form.amount)||0) + (parseFloat(form.vatAmount)||0) } as any })} disabled={!form.amount || !form.companyId || create.isPending}>
                {create.isPending ? "Saving..." : "Add Expense"}
              </Button>
            </div>
          </DialogContent>
            </Dialog>
          </>
        }
      />
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search expenses..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expense No.</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No expenses found.</TableCell></TableRow> :
            filtered?.map(e => (
              <TableRow key={e.id}>
                <TableCell className="font-medium text-primary">{e.expenseNumber}</TableCell>
                <TableCell className="capitalize">{e.category}</TableCell>
                <TableCell>{e.description || "-"}</TableCell>
                <TableCell className="text-right">AED {e.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right font-medium">AED {e.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="capitalize">{e.paymentMethod?.replace("_"," ")}</TableCell>
                <TableCell><Badge variant="secondary" className={statusColors[e.status] ?? ""}>{e.status}</Badge></TableCell>
                <TableCell>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-[#0f2d5a] hover:text-[#1e6ab0]"
                    title="Suggest Journal Entry"
                    disabled={pendingJournalId === e.id}
                    onClick={() => handleJournal(e.id)}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
