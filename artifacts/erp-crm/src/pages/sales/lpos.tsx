import { useState } from "react";
import { useListLpos } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

export function LposList() {
  const [search, setSearch] = useState("");
  const { data: lpos, isLoading } = useListLpos();
  const filtered = lpos?.filter(l => !search || l.lpoNumber.toLowerCase().includes(search.toLowerCase()) || l.clientName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Local Purchase Orders (LPO)</h1>
          <p className="text-muted-foreground">LPOs received from clients for confirmed orders.</p>
        </div>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search LPOs..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>LPO Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>LPO Date</TableHead>
              <TableHead>LPO Value (AED)</TableHead>
              <TableHead>Payment Terms</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No LPOs found.</TableCell></TableRow> :
            filtered?.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-medium text-primary">{l.lpoNumber}</TableCell>
                <TableCell>{l.clientName}</TableCell>
                <TableCell>{l.lpoDate || "-"}</TableCell>
                <TableCell className="font-medium">AED {l.lpoValue?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>{l.paymentTerms || "-"}</TableCell>
                <TableCell><Badge variant="secondary" className={l.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : ""}>{l.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
