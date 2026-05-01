import { useState } from "react";
import { useListDeliveryNotes } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function DeliveryNotesList() {
  const [search, setSearch] = useState("");
  const { data: notes, isLoading } = useListDeliveryNotes();
  const filtered = notes?.filter(n => !search || n.dnNumber.toLowerCase().includes(search.toLowerCase()) || n.clientName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery Notes</h1>
          <p className="text-muted-foreground">Track deliveries to client sites.</p>
        </div>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search delivery notes..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DN Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Delivery Location</TableHead>
              <TableHead>Delivery Date</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No delivery notes found.</TableCell></TableRow> :
            filtered?.map(n => (
              <TableRow key={n.id}>
                <TableCell className="font-medium text-primary">{n.dnNumber}</TableCell>
                <TableCell>{n.clientName}</TableCell>
                <TableCell>{n.projectName || "-"}</TableCell>
                <TableCell>{n.deliveryLocation || "-"}</TableCell>
                <TableCell>{n.deliveryDate || "-"}</TableCell>
                <TableCell>{n.driverName || "-"}</TableCell>
                <TableCell><Badge variant="secondary" className={statusColors[n.status] ?? ""}>{n.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
