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
import { Search, Plus, Trash2, FileText } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { DelegateTaskButton } from "@/components/delegate-task-button";

const statusColors: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-700",
  submitted: "bg-yellow-100 text-yellow-800",
  approved:  "bg-indigo-100 text-indigo-800",
  sent:      "bg-blue-100 text-blue-800",
  confirmed: "bg-purple-100 text-purple-800",
  partial:   "bg-orange-100 text-orange-800",
  received:  "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

interface LineItem { description: string; quantity: number; unit: string; rate: number; amount: number; }
const emptyItem = (): LineItem => ({ description: "", quantity: 1, unit: "nos", rate: 0, amount: 0 });

const PAYMENT_TERMS = [
  { value: "immediate", label: "Immediate / Cash" },
  { value: "15 days",   label: "Net 15 Days" },
  { value: "30 days",   label: "Net 30 Days" },
  { value: "45 days",   label: "Net 45 Days" },
  { value: "60 days",   label: "Net 60 Days" },
  { value: "advance",   label: "100% Advance" },
];

export function PurchaseOrdersList() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    supplierId: "", companyId: "", deliveryDate: "", paymentTerms: "30 days",
    deliveryAddress: "", notes: "", projectRef: "",
  });
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);

  const queryClient = useQueryClient();
  const { data: orders, isLoading } = useListPurchaseOrders({ status: status === "all" ? undefined : status });
  const { data: suppliers } = useListSuppliers();
  const create = useCreatePurchaseOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
        setOpen(false);
        resetForm();
      },
    },
  });

  const resetForm = () => {
    setForm({ supplierId: "", companyId: "", deliveryDate: "", paymentTerms: "30 days", deliveryAddress: "", notes: "", projectRef: "" });
    setItems([emptyItem()]);
  };

  const updateItem = (i: number, field: keyof LineItem, val: string | number) => {
    setItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      const qty  = field === "quantity" ? Number(val) : next[i].quantity;
      const rate = field === "rate"     ? Number(val) : next[i].rate;
      next[i].amount = qty * rate;
      return next;
    });
  };

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const vat      = subtotal * 0.05;
  const grandTotal = subtotal + vat;

  const { filterByCompany, activeCompanyId } = useActiveCompany();
  const isElite = activeCompanyId === 2;
  const primeBtnCls = isElite ? "bg-[#0D0D0D] hover:bg-[#8B0000]" : "bg-[#0f2d5a] hover:bg-[#1e6ab0]";
  const filtered = filterByCompany(orders ?? []).filter(o =>
    !search ||
    o.poNumber.toLowerCase().includes(search.toLowerCase()) ||
    ((o as any).supplierName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    ((o as any).projectRef ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = filtered?.reduce((s, o) => s + (o.total ?? 0), 0) ?? 0;

  const handleCreate = () => {
    const validItems = items.filter(i => i.description.trim());
    create.mutate({
      data: {
        ...form,
        supplierId: parseInt(form.supplierId, 10),
        companyId: parseInt(form.companyId, 10),
        items: validItems,
        projectRef: form.projectRef || undefined,
      } as any,
    });
  };

  return (
    <div className="space-y-4">
      {/* ── PAGE HEADER ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supplier LPO (Purchase Orders)</h1>
          <p className="text-muted-foreground text-sm">Local Purchase Orders issued to suppliers for material and service procurement.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={filtered ?? []}
            columns={[
              { header: "PO Number",     key: "poNumber" },
              { header: "Project Ref",   key: "projectRef" },
              { header: "Supplier",      key: "supplierName" },
              { header: "Total (AED)",   key: "total", format: v => Number(v ?? 0).toFixed(2) },
              { header: "Status",        key: "status" },
              { header: "Delivery Date", key: "deliveryDate" },
              { header: "Payment Terms", key: "paymentTerms" },
            ]}
            filename="supplier-lpos"
            title="Supplier LPOs"
            size="sm"
          />
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className={primeBtnCls}>
                <Plus className="w-4 h-4 mr-2" />Register Supplier LPO
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#0f2d5a]" />
                  New Supplier Local Purchase Order
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-1">
                {/* Row 1: Supplier + Company */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Supplier *</Label>
                    <Select value={form.supplierId} onValueChange={v => setForm(p => ({ ...p, supplierId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>
                        {suppliers?.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Our Company *</Label>
                    <CompanyField value={form.companyId} onChange={v => setForm(p => ({ ...p, companyId: v }))} />
                  </div>
                </div>

                {/* Row 2: Project Ref + Delivery Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Project Reference</Label>
                    <Input
                      value={form.projectRef}
                      onChange={e => setForm(p => ({ ...p, projectRef: e.target.value }))}
                      placeholder="e.g. PM-PRJ-2026-0001"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Required Delivery Date</Label>
                    <Input type="date" value={form.deliveryDate} onChange={e => setForm(p => ({ ...p, deliveryDate: e.target.value }))} />
                  </div>
                </div>

                {/* Row 3: Payment Terms + Delivery Address */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Payment Terms</Label>
                    <Select value={form.paymentTerms} onValueChange={v => setForm(p => ({ ...p, paymentTerms: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_TERMS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Delivery Address / Site</Label>
                    <Input value={form.deliveryAddress} onChange={e => setForm(p => ({ ...p, deliveryAddress: e.target.value }))} placeholder="Site or warehouse address" />
                  </div>
                </div>

                {/* ── LINE ITEMS TABLE ── */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Materials / Items</Label>
                    <Button variant="outline" size="sm" onClick={() => setItems(p => [...p, emptyItem()])}>
                      <Plus className="w-3.5 h-3.5 mr-1" />Add Item
                    </Button>
                  </div>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#0f2d5a] text-white">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold">Description / Material</th>
                          <th className="text-center px-2 py-2 font-semibold w-20">Qty</th>
                          <th className="text-center px-2 py-2 font-semibold w-20">Unit</th>
                          <th className="text-right px-2 py-2 font-semibold w-28">Rate (AED)</th>
                          <th className="text-right px-2 py-2 font-semibold w-28">Amount (AED)</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => (
                          <tr key={i} className={`border-t ${i % 2 === 0 ? "" : "bg-muted/30"}`}>
                            <td className="px-2 py-1">
                              <Input
                                value={item.description}
                                onChange={e => updateItem(i, "description", e.target.value)}
                                className="h-8 text-sm"
                                placeholder="Material description"
                              />
                            </td>
                            <td className="px-1 py-1">
                              <Input
                                type="number"
                                min={0}
                                value={item.quantity}
                                onChange={e => updateItem(i, "quantity", e.target.value)}
                                className="h-8 text-right text-sm w-full"
                              />
                            </td>
                            <td className="px-1 py-1">
                              <Input
                                value={item.unit}
                                onChange={e => updateItem(i, "unit", e.target.value)}
                                className="h-8 text-sm"
                                placeholder="nos"
                              />
                            </td>
                            <td className="px-1 py-1">
                              <Input
                                type="number"
                                min={0}
                                value={item.rate}
                                onChange={e => updateItem(i, "rate", e.target.value)}
                                className="h-8 text-right text-sm w-full"
                              />
                            </td>
                            <td className="px-2 py-1 text-right font-medium whitespace-nowrap">
                              {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-1 py-1">
                              <Button
                                variant="ghost" size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setItems(p => p.filter((_, j) => j !== i))}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {items.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center py-4 text-muted-foreground text-sm">
                              No items — click "Add Item" above
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="border-t bg-muted/20">
                        <tr>
                          <td colSpan={4} className="px-3 py-1.5 text-sm text-right text-muted-foreground">Subtotal:</td>
                          <td className="px-2 py-1.5 text-right text-sm font-medium">{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td></td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="px-3 py-1 text-sm text-right text-muted-foreground">VAT (5%):</td>
                          <td className="px-2 py-1 text-right text-sm text-muted-foreground">{vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td></td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="px-3 py-2 text-sm text-right font-bold">Grand Total (AED):</td>
                          <td className="px-2 py-2 text-right font-bold text-[#0f2d5a]">{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <Label>Notes / Special Instructions</Label>
                  <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Any special terms, instructions, or remarks..." />
                </div>

                <Button
                  className={`w-full ${primeBtnCls}`}
                  onClick={handleCreate}
                  disabled={!form.supplierId || !form.companyId || create.isPending}
                >
                  {create.isPending ? "Registering..." : "Register Supplier LPO"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── SUMMARY BAR ── */}
      <div className="flex items-center gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Total: <span className="font-semibold text-foreground">AED {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          <span className="ml-2 text-muted-foreground">· {filtered.length} LPO{filtered.length !== 1 ? "s" : ""}</span>
        </p>
        <div className="ml-auto flex items-center gap-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search PO no., supplier or project..."
              className="pl-8 w-72"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {["draft","submitted","approved","sent","confirmed","partial","received","cancelled"].map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Ref</TableHead>
              <TableHead>LPO / PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Delivery Date</TableHead>
              <TableHead>Payment Terms</TableHead>
              <TableHead className="text-right">Total (AED)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No purchase orders found.</TableCell></TableRow>
            ) : filtered.map(po => (
              <TableRow key={po.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  {(po as any).projectRef ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#0f2d5a] text-white border border-blue-300/30 tracking-wide whitespace-nowrap">
                      {(po as any).projectRef}
                    </span>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell className="font-medium font-mono text-sm">
                  <Link href={`/procurement/purchase-orders/${po.id}`} className="text-primary hover:underline">
                    {po.poNumber}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{(po as any).supplierName || "—"}</TableCell>
                <TableCell className="text-sm">{po.deliveryDate || "—"}</TableCell>
                <TableCell className="text-sm">{po.paymentTerms || "—"}</TableCell>
                <TableCell className="text-right font-medium">
                  AED {(po.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={`capitalize ${statusColors[po.status] ?? ""}`}>
                    {po.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DelegateTaskButton
                    taskType="lpo"
                    taskLabel={`Process LPO ${po.poNumber} — ${(po as any).supplierName || "Supplier"}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
