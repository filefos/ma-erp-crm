import { useState } from "react";
import { useListCheques, useCreateCheque, useListBankAccounts, useListCompanies, getListChequesQueryKey } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  printed: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  issued: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  cleared: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  bounced: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function ChequesList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    payeeName: "", chequeNumber: "", chequeDate: "", amount: "",
    bankAccountId: "", memo: "", companyId: "",
  });
  const queryClient = useQueryClient();
  const { data: cheques, isLoading } = useListCheques({ status: status === "all" ? undefined : status });
  const { data: bankAccounts } = useListBankAccounts();
  const { data: companies } = useListCompanies();
  const create = useCreateCheque({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListChequesQueryKey() });
        setOpen(false);
        setForm({ payeeName: "", chequeNumber: "", chequeDate: "", amount: "", bankAccountId: "", memo: "", companyId: "" });
      },
    },
  });

  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(cheques ?? []).filter(c =>
    !search ||
    c.chequeNumber.toLowerCase().includes(search.toLowerCase()) ||
    c.payeeName.toLowerCase().includes(search.toLowerCase())
  );

  const totalIssued = filtered?.filter(c => c.status === "issued").reduce((s, c) => s + (c.amount ?? 0), 0) ?? 0;
  const totalCleared = filtered?.filter(c => c.status === "cleared").reduce((s, c) => s + (c.amount ?? 0), 0) ?? 0;


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cheque Management</h1>
          <p className="text-muted-foreground">Track and manage company cheques.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={(filtered ?? []) as Record<string, unknown>[]}
            columns={[
              { header: "Cheque No.", key: "chequeNumber" },
              { header: "Payee", key: "payeeName" },
              { header: "Bank", key: "bankName" },
              { header: "Amount (AED)", key: "amount", format: v => Number(v ?? 0).toFixed(2) },
              { header: "Status", key: "status" },
              { header: "Cheque Date", key: "chequeDate" },
            ]}
            filename="cheques"
            title="Cheques"
            size="sm"
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]">
                <Plus className="w-4 h-4 mr-2" />New Cheque
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Cheque</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1 col-span-2"><Label>Payee Name *</Label><Input value={form.payeeName} onChange={e => setForm(p => ({...p, payeeName: e.target.value}))} placeholder="Person or company name" /></div>
                <div className="space-y-1"><Label>Cheque Number *</Label><Input value={form.chequeNumber} onChange={e => setForm(p => ({...p, chequeNumber: e.target.value}))} placeholder="123456" /></div>
                <div className="space-y-1"><Label>Cheque Date *</Label><Input type="date" value={form.chequeDate} onChange={e => setForm(p => ({...p, chequeDate: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Amount (AED) *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Company</Label>
                  <Select value={form.companyId} onValueChange={v => setForm(p => ({...p, companyId: v}))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.shortName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 col-span-2"><Label>Bank Account</Label>
                  <Select value={form.bankAccountId} onValueChange={v => setForm(p => ({...p, bankAccountId: v}))}>
                    <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                    <SelectContent>{bankAccounts?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.bankName} — {b.accountNumber}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 col-span-2"><Label>Memo / Purpose</Label><Input value={form.memo} onChange={e => setForm(p => ({...p, memo: e.target.value}))} placeholder="Payment for invoice #..." /></div>
              </div>
              <Button
                className="mt-4 bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                onClick={() => create.mutate({ data: { ...form, amount: parseFloat(form.amount) || 0, bankAccountId: form.bankAccountId ? parseInt(form.bankAccountId, 10) : undefined, companyId: form.companyId ? parseInt(form.companyId, 10) : undefined } as any })}
                disabled={!form.payeeName || !form.chequeNumber || !form.amount || create.isPending}
              >
                {create.isPending ? "Creating..." : "Create Cheque"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-xs text-muted-foreground">Total Issued</div>
          <div className="text-xl font-bold text-amber-600">AED {totalIssued.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-xs text-muted-foreground">Total Cleared</div>
          <div className="text-xl font-bold text-green-600">AED {totalCleared.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search cheques..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {["draft","approved","printed","issued","cleared","bounced","cancelled"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cheque No.</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>Payee</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead className="text-right">Amount (AED)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No cheques found.</TableCell></TableRow> :
            filtered?.map(c => (
              <TableRow key={c.id} className="hover:bg-muted/50">
                <TableCell className="font-medium font-mono">
                  <Link href={`/accounts/cheques/${c.id}`} className="text-primary hover:underline">
                    {c.chequeNumber}
                  </Link>
                </TableCell>
                <TableCell>{(c as any).bankName || "-"}</TableCell>
                <TableCell className="font-medium">{c.payeeName}</TableCell>
                <TableCell>{c.chequeDate}</TableCell>
                <TableCell className="max-w-[160px] truncate text-muted-foreground text-sm">{(c as any).memo || (c as any).voucherReference || "-"}</TableCell>
                <TableCell className="text-right font-medium">AED {c.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell><Badge variant="secondary" className={statusColors[c.status] ?? ""}>{c.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
