import { useState } from "react";
import { useListProformaInvoices } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

export function ProformaInvoicesList() {
  const [search, setSearch] = useState("");
  const { data: invoices, isLoading } = useListProformaInvoices();
  const filtered = invoices?.filter(i => !search || i.piNumber.toLowerCase().includes(search.toLowerCase()) || i.clientName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proforma Invoices</h1>
          <p className="text-muted-foreground">Pre-shipment invoices sent to clients.</p>
        </div>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search proforma invoices..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PI Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Total (AED)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No proforma invoices found.</TableCell></TableRow> :
            filtered?.map(inv => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium text-primary">{inv.piNumber}</TableCell>
                <TableCell>{inv.clientName}</TableCell>
                <TableCell>{inv.projectName || "-"}</TableCell>
                <TableCell className="font-medium">AED {inv.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell><Badge variant="secondary" className={statusColors[inv.status] ?? ""}>{inv.status}</Badge></TableCell>
                <TableCell>{inv.validityDate || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
