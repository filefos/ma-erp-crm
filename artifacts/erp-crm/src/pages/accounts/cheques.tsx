import { useState } from "react";
import { useListCheques, useListBankAccounts } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

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
  const { data: cheques, isLoading } = useListCheques({ status: status === "all" ? undefined : status });
  const filtered = cheques?.filter(c => !search || c.chequeNumber.toLowerCase().includes(search.toLowerCase()) || c.payeeName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cheque Management</h1>
          <p className="text-muted-foreground">Track and manage company cheques.</p>
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
              <TableHead className="text-right">Amount (AED)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No cheques found.</TableCell></TableRow> :
            filtered?.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium font-mono">{c.chequeNumber}</TableCell>
                <TableCell>{(c as any).bankName || "-"}</TableCell>
                <TableCell>{c.payeeName}</TableCell>
                <TableCell>{c.chequeDate}</TableCell>
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
