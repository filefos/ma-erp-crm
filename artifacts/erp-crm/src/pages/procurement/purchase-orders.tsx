import { useState } from "react";
import { useListPurchaseOrders } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  confirmed: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  received: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function PurchaseOrdersList() {
  const [status, setStatus] = useState("all");
  const { data: orders, isLoading } = useListPurchaseOrders({ status: status === "all" ? undefined : status });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">Official orders placed with suppliers.</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {["draft","sent","confirmed","partial","received","cancelled"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Delivery Date</TableHead>
              <TableHead>Payment Terms</TableHead>
              <TableHead className="text-right">Total (AED)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            orders?.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No purchase orders found.</TableCell></TableRow> :
            orders?.map(po => (
              <TableRow key={po.id}>
                <TableCell className="font-medium text-primary">{po.poNumber}</TableCell>
                <TableCell>{(po as any).supplierName || "-"}</TableCell>
                <TableCell>{po.deliveryDate || "-"}</TableCell>
                <TableCell>{po.paymentTerms || "-"}</TableCell>
                <TableCell className="text-right font-medium">AED {po.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell><Badge variant="secondary" className={statusColors[po.status] ?? ""}>{po.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
