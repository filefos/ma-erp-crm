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
import { useListCompanies } from "@workspace/api-client-react";
import { Plus, Search } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";
import { getListExpensesQueryKey } from "@workspace/api-client-react";

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
  const queryClient = useQueryClient();
  const { data: expenses, isLoading } = useListExpenses();
  const { data: companies } = useListCompanies();
  const create = useCreateExpense({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() }); setOpen(false); } } });

  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(expenses ?? []).filter(e => !search || e.category.toLowerCase().includes(search.toLowerCase()) || e.description?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">Track and manage all company expenses.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={(expenses ?? []) as unknown as Record<string, unknown>[]}
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
          />
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Plus className="w-4 h-4 mr-2" />Add Expense</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Expense</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Company *</Label>
                  <Select value={form.companyId} onValueChange={v => setForm(p => ({...p, companyId: v}))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.shortName}</SelectItem>)}</SelectContent>
                  </Select>
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
        </div>
      </div>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No expenses found.</TableCell></TableRow> :
            filtered?.map(e => (
              <TableRow key={e.id}>
                <TableCell className="font-medium text-primary">{e.expenseNumber}</TableCell>
                <TableCell className="capitalize">{e.category}</TableCell>
                <TableCell>{e.description || "-"}</TableCell>
                <TableCell className="text-right">AED {e.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right font-medium">AED {e.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="capitalize">{e.paymentMethod?.replace("_"," ")}</TableCell>
                <TableCell><Badge variant="secondary" className={statusColors[e.status] ?? ""}>{e.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
