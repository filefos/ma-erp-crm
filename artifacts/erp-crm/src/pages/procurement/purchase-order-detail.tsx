import { useState, useEffect } from "react";
import { useGetPurchaseOrder, useListSuppliers, useListCompanies, getListPurchaseOrdersQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, Pencil, Check, X, Printer, Download } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-800",
  confirmed: "bg-purple-100 text-purple-800",
  partial: "bg-amber-100 text-amber-800",
  received: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};
const STATUSES = ["draft", "sent", "confirmed", "partial", "received", "cancelled"];

interface Item { description: string; quantity: number; unit: string; rate: number; amount: number; }
const emptyItem = (): Item => ({ description: "", quantity: 1, unit: "nos", rate: 0, amount: 0 });

function exportCSV(po: any) {
  const rows = [
    ["PO Number", po.poNumber],
    ["Supplier", po.supplierName ?? ""],
    ["Status", po.status],
    ["Delivery Date", po.deliveryDate ?? ""],
    ["Payment Terms", po.paymentTerms ?? ""],
    ["Delivery Address", po.deliveryAddress ?? ""],
    ["Notes", po.notes ?? ""],
    [],
    ["#", "Description", "Qty", "Unit", "Rate (AED)", "Amount (AED)"],
    ...(po.items ?? []).map((it: any, i: number) => [i + 1, it.description, it.quantity, it.unit, it.rate, it.amount]),
    [],
    ["Total (AED)", po.total ?? 0],
  ];
  const csv = rows.map(r => r.map(String).map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = `${po.poNumber}.csv`;
  a.click();
}

interface Props { id: string }

export function PurchaseOrderDetail({ id }: Props) {
  const pid = parseInt(id, 10);
  const [, navigate] = useLocation();
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/procurement/purchase-orders"><ArrowLeft className="w-4 h-4 mr-1" />Back</Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight font-mono">{(po as any).poNumber}</h1>
          <p className="text-sm text-muted-foreground">Purchase Order</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={STATUS_COLORS[(po as any).status] ?? ""}>{(po as any).status}</Badge>
          {!editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="w-3.5 h-3.5 mr-1" />Edit</Button>
              <Button variant="outline" size="sm" onClick={() => exportCSV({ ...(po as any), items })}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-3.5 h-3.5 mr-1" />Print</Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); }}><X className="w-3.5 h-3.5 mr-1" />Cancel</Button>
              <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={handleSave} disabled={saving}>
                <Check className="w-3.5 h-3.5 mr-1" />{saving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Order Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {editing ? (
            <>
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
            </>
          ) : (
            <>
              <div><p className="text-xs text-muted-foreground">Supplier</p><p className="font-medium">{(po as any).supplierName || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Company</p><p className="font-medium">{companies?.find(c => c.id === (po as any).companyId)?.name || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Delivery Date</p><p className="font-medium">{(po as any).deliveryDate || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Payment Terms</p><p className="font-medium">{(po as any).paymentTerms || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Created</p><p className="font-medium">{new Date((po as any).createdAt).toLocaleDateString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Delivery Address</p><p className="font-medium">{(po as any).deliveryAddress || "—"}</p></div>
              {(po as any).notes && <div className="col-span-2"><p className="text-xs text-muted-foreground">Notes</p><p className="font-medium">{(po as any).notes}</p></div>}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line Items</CardTitle>
          {editing && <Button variant="outline" size="sm" onClick={() => setItems(p => [...p, emptyItem()])}><Plus className="w-4 h-4 mr-1" />Add Row</Button>}
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
                {editing && <th className="w-8"></th>}
              </tr></thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-muted-foreground text-sm">{editing ? "No items — add a row above" : "No line items recorded."}</td></tr>
                ) : items.map((item, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {editing ? (
                      <>
                        <td className="py-1 pr-2"><Input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} className="h-8" /></td>
                        <td className="py-1 px-1"><Input type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="h-8 text-right w-full" /></td>
                        <td className="py-1 px-1"><Input value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} className="h-8" /></td>
                        <td className="py-1 px-1"><Input type="number" value={item.rate} onChange={e => updateItem(i, "rate", e.target.value)} className="h-8 text-right w-full" /></td>
                        <td className="py-1 pl-1 text-right font-medium">AED {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="py-1 pl-1"><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItems(p => p.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button></td>
                      </>
                    ) : (
                      <>
                        <td className="py-2">{item.description}</td>
                        <td className="py-2 text-right">{item.quantity}</td>
                        <td className="py-2 pl-2">{item.unit}</td>
                        <td className="py-2 text-right">AED {item.rate?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 text-right font-medium">AED {item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-2">
              <Separator />
              <div className="flex justify-between font-bold text-lg pt-1">
                <span>Total</span>
                <span className="text-primary">AED {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signature block */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Prepared by</p>
              <p className="font-medium">{preparedByName}</p>
              <div className="mt-6 border-t border-gray-300 pt-1 text-xs text-muted-foreground">Signature</div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Authorised Signatory</p>
              <p className="font-medium">{companies?.find(c => c.id === (po as any).companyId)?.name || ""}</p>
              <div className="mt-6 border-t border-gray-300 pt-1 text-xs text-muted-foreground">Signature</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
