import { useState } from "react";
import { useListPurchaseOrders, useCreatePurchaseOrder, useListSuppliers, useListCompanies, getListPurchaseOrdersQueryKey } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyField } from "@/components/CompanyField";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  confirmed: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  partial: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  received: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function PurchaseOrdersList() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    supplierId: "", deliveryDate: "", paymentTerms: "30 days",
    deliveryAddress: "", notes: "", companyId: "",
  });
  const queryClient = useQueryClient();
  const { data: orders, isLoading } = useListPurchaseOrders({ status: status === "all" ? undefined : status });
  const { data: suppliers } = useListSuppliers();
  const { data: companies } = useListCompanies();
  const create = useCreatePurchaseOrder({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
        setOpen(false);
        setForm({ supplierId: "", deliveryDate: "", paymentTerms: "30 days", deliveryAddress: "", notes: "", companyId: "" });
      },
    },
  });

  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(orders ?? []).filter(o =>
    !search ||
    o.poNumber.toLowerCase().includes(search.toLowerCase()) ||
    ((o as any).supplierName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = filtered?.reduce((s, o) => s + (o.total ?? 0), 0) ?? 0;


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">Official orders placed with suppliers.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={(filtered ?? [])}
            columns={[
              { header: "PO Number", key: "poNumber" },
              { header: "Supplier", key: "supplierName" },
              { header: "Total (AED)", key: "total", format: v => Number(v ?? 0).toFixed(2) },
              { header: "Status", key: "status" },
              { header: "Delivery Date", key: "deliveryDate" },
              { header: "Payment Terms", key: "paymentTerms" },
            ]}
            filename="purchase-orders"
            title="Purchase Orders"
            size="sm"
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]">
                <Plus className="w-4 h-4 mr-2" />New PO
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1"><Label>Supplier *</Label>
                  <Select value={form.supplierId} onValueChange={v => setForm(p => ({...p, supplierId: v}))}>
                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>{suppliers?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Company *</Label>
                    <CompanyField value={form.companyId} onChange={v => setForm(p => ({...p, companyId: v}))} />
                  </div>
                  <div className="space-y-1"><Label>Delivery Date</Label><Input type="date" value={form.deliveryDate} onChange={e => setForm(p => ({...p, deliveryDate: e.target.value}))} /></div>
                </div>
                <div className="space-y-1"><Label>Payment Terms</Label>
                  <Select value={form.paymentTerms} onValueChange={v => setForm(p => ({...p, paymentTerms: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Immediate / Cash</SelectItem>
                      <SelectItem value="15 days">Net 15 Days</SelectItem>
                      <SelectItem value="30 days">Net 30 Days</SelectItem>
                      <SelectItem value="45 days">Net 45 Days</SelectItem>
                      <SelectItem value="60 days">Net 60 Days</SelectItem>
                      <SelectItem value="advance">100% Advance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Delivery Address</Label><Input value={form.deliveryAddress} onChange={e => setForm(p => ({...p, deliveryAddress: e.target.value}))} placeholder="Site or warehouse address" /></div>
                <div className="space-y-1"><Label>Notes / Instructions</Label><Textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={2} /></div>
              </div>
              <Button
                className="mt-4 bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                onClick={() => create.mutate({ data: { ...form, supplierId: parseInt(form.supplierId, 10), companyId: parseInt(form.companyId, 10) } as any })}
                disabled={!form.supplierId || !form.companyId || create.isPending}
              >
                {create.isPending ? "Creating..." : "Create Purchase Order"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-sm text-muted-foreground">
          Total filtered value: <span className="font-semibold text-foreground">AED {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="ml-auto flex gap-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search orders..." className="pl-8 w-56" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {["draft","sent","confirmed","partial","received","cancelled"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
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
            filtered?.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No purchase orders found.</TableCell></TableRow> :
            filtered?.map(po => (
              <TableRow key={po.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell className="font-medium font-mono text-sm">
                  <Link href={`/procurement/purchase-orders/${po.id}`} className="text-primary hover:underline">
                    {po.poNumber}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{(po as any).supplierName || "-"}</TableCell>
                <TableCell className="text-sm">{po.deliveryDate || "-"}</TableCell>
                <TableCell className="text-sm">{po.paymentTerms || "-"}</TableCell>
                <TableCell className="text-right font-medium">AED {(po.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell><Badge variant="secondary" className={statusColors[po.status] ?? ""}>{po.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
