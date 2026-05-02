import { useState, useEffect } from "react";
import { useGetPurchaseOrder, useListSuppliers, useListCompanies, getListPurchaseOrdersQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { ExportButtons } from "@/components/export-buttons";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { DocumentPrint } from "@/components/document-print";
import type { DocumentData } from "@/components/document-print";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-800",
  confirmed: "bg-purple-100 text-purple-800",
  partial: "bg-orange-100 text-orange-800",
  received: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};
const STATUSES = ["draft", "sent", "confirmed", "partial", "received", "cancelled"];

interface Item { description: string; quantity: number; unit: string; rate: number; amount: number; }
const emptyItem = (): Item => ({ description: "", quantity: 1, unit: "nos", rate: 0, amount: 0 });

interface Props { id: string }

export function PurchaseOrderDetail({ id }: Props) {
  const pid = parseInt(id, 10);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const token = localStorage.getItem("erp_token");

  const { data: po, isLoading, refetch } = useGetPurchaseOrder(pid);
  const { data: suppliers } = useListSuppliers();
  const { data: companies } = useListCompanies();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplierId: "", companyId: "", deliveryDate: "", paymentTerms: "",
    deliveryAddress: "", notes: "", status: "draft",
  });
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (po) {
      setForm({
        supplierId: String((po as any).supplierId ?? ""),
        companyId: String((po as any).companyId ?? ""),
        deliveryDate: (po as any).deliveryDate ?? "",
        paymentTerms: (po as any).paymentTerms ?? "",
        deliveryAddress: (po as any).deliveryAddress ?? "",
        notes: (po as any).notes ?? "",
        status: po.status ?? "draft",
      });
      const raw = (po as any).items ?? [];
      setItems(Array.isArray(raw) ? raw : []);
    }
  }, [po]);

  const updateItem = (i: number, field: keyof Item, val: string | number) => {
    setItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      const qty = field === "quantity" ? Number(val) : next[i].quantity;
      const rate = field === "rate" ? Number(val) : next[i].rate;
      next[i].amount = qty * rate;
      return next;
    });
  };

  const total = items.reduce((s, it) => s + it.amount, 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/purchase-orders/${pid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          supplierId: parseInt(form.supplierId, 10),
          companyId: parseInt(form.companyId, 10),
          items,
          total,
        }),
      });
      await refetch();
      queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading purchase order...</div>;
  if (!po) return <div className="py-20 text-center text-muted-foreground">Purchase order not found.</div>;

  const preparedByName = (user as any)?.name ?? "";
  const supplier = suppliers?.find(s => s.id === (po as any).supplierId);

  const docItems = ((po as any).items ?? []) as Item[];
  const docTotal = docItems.reduce((s, it) => s + it.amount, 0);

  const docData: DocumentData = {
    type: "purchase_order",
    docNumber: (po as any).poNumber,
    companyId: (po as any).companyId ?? 1,
    clientName: (po as any).supplierName ?? supplier?.name ?? "—",
    supplierName: (po as any).supplierName ?? supplier?.name ?? "—",
    supplierPhone: (supplier as any)?.phone ?? undefined,
    supplierEmail: (supplier as any)?.email ?? undefined,
    date: (po as any).createdAt
      ? new Date((po as any).createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : undefined,
    deliveryDate: (po as any).deliveryDate ?? undefined,
    deliveryAddress: (po as any).deliveryAddress ?? undefined,
    paymentTerms: (po as any).paymentTerms ?? undefined,
    notes: (po as any).notes ?? undefined,
    grandTotal: (po as any).total ?? docTotal,
    items: docItems.map(i => ({
      description: i.description,
      sizeStatus: i.unit,
      unitPrice: i.rate,
      quantity: i.quantity,
      total: i.amount,
    })),
    preparedByName,
  };

  if (editing) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            <ArrowLeft className="w-4 h-4 mr-1" />Cancel
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight font-mono">{(po as any).poNumber}</h1>
            <p className="text-sm text-muted-foreground">Edit Purchase Order</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              <X className="w-3.5 h-3.5 mr-1" />Cancel
            </Button>
            <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={handleSave} disabled={saving}>
              <Check className="w-3.5 h-3.5 mr-1" />{saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Order Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Supplier</Label>
              <Select value={form.supplierId} onValueChange={v => setForm(p => ({...p, supplierId: v}))}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{suppliers?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Company</Label>
              <Select value={form.companyId} onValueChange={v => setForm(p => ({...p, companyId: v}))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.shortName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Delivery Date</Label>
              <Input type="date" value={form.deliveryDate} onChange={e => setForm(p => ({...p, deliveryDate: e.target.value}))} />
            </div>
            <div className="space-y-1"><Label>Payment Terms</Label>
              <Select value={form.paymentTerms} onValueChange={v => setForm(p => ({...p, paymentTerms: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["immediate","15 days","30 days","45 days","60 days","advance"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({...p, status: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Delivery Address</Label>
              <Input value={form.deliveryAddress} onChange={e => setForm(p => ({...p, deliveryAddress: e.target.value}))} />
            </div>
            <div className="space-y-1 col-span-2"><Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setItems(p => [...p, emptyItem()])}>
              <Plus className="w-4 h-4 mr-1" />Add Row
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b">
                  <th className="text-left pb-2 font-semibold">Description</th>
                  <th className="text-right pb-2 font-semibold w-20">Qty</th>
                  <th className="text-left pb-2 pl-2 font-semibold w-20">Unit</th>
                  <th className="text-right pb-2 font-semibold w-32">Rate (AED)</th>
                  <th className="text-right pb-2 font-semibold w-32">Amount (AED)</th>
                  <th className="w-8"></th>
                </tr></thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-6 text-muted-foreground text-sm">No items — add a row above</td></tr>
                  ) : items.map((item, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1 pr-2"><Input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} className="h-8" /></td>
                      <td className="py-1 px-1"><Input type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="h-8 text-right w-full" /></td>
                      <td className="py-1 px-1"><Input value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} className="h-8" /></td>
                      <td className="py-1 px-1"><Input type="number" value={item.rate} onChange={e => updateItem(i, "rate", e.target.value)} className="h-8 text-right w-full" /></td>
                      <td className="py-1 pl-1 text-right font-medium">AED {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-1 pl-1"><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItems(p => p.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <div className="w-48 font-bold text-lg flex justify-between pt-1 border-t">
                <span>Total</span>
                <span className="text-primary">AED {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="no-print flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/procurement/purchase-orders"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
        <Badge className={`capitalize ${STATUS_COLORS[(po as any).status] ?? "bg-gray-100"}`}>{(po as any).status}</Badge>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1" />Edit
          </Button>
          <ExportButtons docNumber={(po as any).poNumber ?? po.id?.toString() ?? "PO"} />
        </div>
      </div>

      <DocumentPrint data={docData} />
    </div>
  );
}
