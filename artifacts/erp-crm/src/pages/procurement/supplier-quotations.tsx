import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSupplierQuotations, useCreateSupplierQuotation, useUpdateSupplierQuotation,
  useDeleteSupplierQuotation, useSelectSupplierQuotation, useRejectSupplierQuotation,
  useListRfqs, useListSuppliers, useListCompanies
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, CheckCircle, X, Trash2, Edit, ChevronDown, ChevronUp } from "lucide-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  selected: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

interface SqItem { itemName: string; quantity: number; unit: string; unitPrice: number; vat: number; total: number; }

const EMPTY_ITEM: SqItem = { itemName: "", quantity: 1, unit: "", unitPrice: 0, vat: 0, total: 0 };

export function SupplierQuotationsList() {
  const { activeCompanyId } = useActiveCompany();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rfqFilter, setRfqFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectDialog, setSelectDialog] = useState<{ id: number; sqNumber: string } | null>(null);
  const [selectReason, setSelectReason] = useState("");
  const [rejectId, setRejectId] = useState<number | null>(null);

  const emptyForm = () => ({
    companyId: activeCompanyId,
    rfqId: "" as string | number,
    supplierId: "" as string | number,
    supplierQuotationRef: "",
    quotationDate: new Date().toISOString().slice(0, 10),
    deliveryTime: "",
    paymentTerms: "",
    warranty: "",
    notes: "",
    items: [{ ...EMPTY_ITEM }] as SqItem[],
  });
  const [form, setForm] = useState(emptyForm());

  const { data: sqs = [], isLoading } = useListSupplierQuotations({ companyId: activeCompanyId });
  const { data: rfqs = [] } = useListRfqs({ companyId: activeCompanyId });
  const { data: suppliers = [] } = useListSuppliers();
  const { data: companies = [] } = useListCompanies();

  const createSq = useCreateSupplierQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/supplier-quotations"] }); setDialogOpen(false); toast.success("Quotation recorded"); } } });
  const updateSq = useUpdateSupplierQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/supplier-quotations"] }); setDialogOpen(false); toast.success("Quotation updated"); } } });
  const deleteSq = useDeleteSupplierQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/supplier-quotations"] }); setDeleteId(null); toast.success("Quotation deleted"); } } });
  const selectSq = useSelectSupplierQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/supplier-quotations"] }); qc.invalidateQueries({ queryKey: ["/rfqs"] }); setSelectDialog(null); toast.success("Quotation selected as winner"); } } });
  const rejectSq = useRejectSupplierQuotation({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/supplier-quotations"] }); setRejectId(null); toast.success("Quotation rejected"); } } });

  const filtered = sqs.filter(sq => {
    const ms = !search || sq.sqNumber.toLowerCase().includes(search.toLowerCase()) || (sq as any).supplierName?.toLowerCase().includes(search.toLowerCase());
    const mst = statusFilter === "all" || sq.status === statusFilter;
    const mr = rfqFilter === "all" || String(sq.rfqId) === rfqFilter;
    return ms && mst && mr;
  });

  function calcTotals(items: SqItem[]) {
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const vatAmount = items.reduce((s, i) => s + i.vat, 0);
    return { subtotal, vatAmount, total: subtotal + vatAmount };
  }

  function updateItem(i: number, k: keyof SqItem, v: string | number) {
    setForm(f => {
      const items = f.items.map((item, idx) => {
        if (idx !== i) return item;
        const updated = { ...item, [k]: v };
        if (k === "unitPrice" || k === "quantity") {
          updated.total = updated.unitPrice * updated.quantity + updated.vat;
        }
        if (k === "vat") {
          updated.total = updated.unitPrice * updated.quantity + Number(v);
        }
        return updated;
      });
      return { ...f, items };
    });
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(sq: any) {
    setEditingId(sq.id);
    setForm({
      companyId: sq.companyId,
      rfqId: sq.rfqId ?? "",
      supplierId: sq.supplierId,
      supplierQuotationRef: sq.supplierQuotationRef ?? "",
      quotationDate: sq.quotationDate ?? new Date().toISOString().slice(0, 10),
      deliveryTime: sq.deliveryTime ?? "",
      paymentTerms: sq.paymentTerms ?? "",
      warranty: sq.warranty ?? "",
      notes: sq.notes ?? "",
      items: sq.items?.length ? sq.items : [{ ...EMPTY_ITEM }],
    });
    setDialogOpen(true);
  }

  function handleSubmit(): void {
    if (!form.supplierId) { toast.error("Please select a supplier"); return; }
    const { subtotal, vatAmount, total } = calcTotals(form.items);
    const payload = {
      ...form,
      companyId: Number(form.companyId),
      supplierId: Number(form.supplierId),
      rfqId: form.rfqId ? Number(form.rfqId) : undefined,
      subtotal, vatAmount, total,
      items: form.items.filter(i => i.itemName.trim()),
    };
    if (editingId) updateSq.mutate({ id: editingId, data: payload as any });
    else createSq.mutate({ data: payload as any });
  }

  const fmt = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0f2d5a] dark:text-white">Supplier Quotations</h1>
          <p className="text-muted-foreground text-sm">{sqs.length} quotations received · Compare and select the best offer</p>
        </div>
        <Button onClick={openCreate} className="bg-[#1e6ab0] hover:bg-[#0f2d5a]">
          <Plus className="w-4 h-4 mr-2" />Record Quotation
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search quotations…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={rfqFilter} onValueChange={setRfqFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Filter by RFQ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All RFQs</SelectItem>
            {rfqs.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.rfqNumber}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="selected">Selected</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No quotations found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sq => (
            <Card key={sq.id} className={`border ${sq.status === "selected" ? "border-green-300 dark:border-green-700" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm text-[#0f2d5a] dark:text-white">{sq.sqNumber}</span>
                      <Badge className={STATUS_COLORS[sq.status] ?? ""}>{sq.status}</Badge>
                      <span className="font-medium text-sm">{(sq as any).supplierName}</span>
                      {(sq as any).rfqNumber && <Badge variant="outline" className="text-xs">RFQ: {(sq as any).rfqNumber}</Badge>}
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                      <span className="font-semibold text-base text-[#0f2d5a] dark:text-white">AED {fmt(sq.total ?? 0)}</span>
                      {sq.deliveryTime && <span>Delivery: {sq.deliveryTime}</span>}
                      {sq.paymentTerms && <span>{sq.paymentTerms}</span>}
                      {sq.quotationDate && <span>Date: {sq.quotationDate}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center flex-shrink-0">
                    {sq.status === "received" && (
                      <>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { setSelectDialog({ id: sq.id, sqNumber: sq.sqNumber }); setSelectReason(""); }}>
                          <CheckCircle className="w-3 h-3 mr-1" />Select
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-300" onClick={() => setRejectId(sq.id)}>
                          <X className="w-3 h-3 mr-1" />Reject
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(sq)}><Edit className="w-4 h-4" /></Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteId(sq.id)}><Trash2 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setExpandedId(expandedId === sq.id ? null : sq.id)}>
                      {expandedId === sq.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                {expandedId === sq.id && (
                  <div className="mt-3 pt-3 border-t">
                    {sq.items && (sq.items as any[]).length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Item</TableHead>
                            <TableHead className="text-xs text-right">Qty</TableHead>
                            <TableHead className="text-xs">Unit</TableHead>
                            <TableHead className="text-xs text-right">Unit Price</TableHead>
                            <TableHead className="text-xs text-right">VAT</TableHead>
                            <TableHead className="text-xs text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(sq.items as any[]).map((item, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm">{item.itemName}</TableCell>
                              <TableCell className="text-sm text-right">{item.quantity}</TableCell>
                              <TableCell className="text-sm">{item.unit}</TableCell>
                              <TableCell className="text-sm text-right">AED {fmt(item.unitPrice ?? 0)}</TableCell>
                              <TableCell className="text-sm text-right">AED {fmt(item.vat ?? 0)}</TableCell>
                              <TableCell className="text-sm text-right font-medium">AED {fmt(item.total ?? 0)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-semibold bg-muted/50">
                            <TableCell colSpan={5} className="text-right text-sm">Total</TableCell>
                            <TableCell className="text-right text-sm">AED {fmt(sq.total ?? 0)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    )}
                    {(sq as any).selectionReason && <p className="text-sm text-green-700 dark:text-green-300 mt-2">Selection reason: {(sq as any).selectionReason}</p>}
                    {sq.notes && <p className="text-sm text-muted-foreground mt-2">{sq.notes}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#0f2d5a] dark:text-white">{editingId ? "Edit Quotation" : "Record Supplier Quotation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Company</Label>
                <Select value={String(form.companyId)} onValueChange={v => setForm(f => ({ ...f, companyId: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Linked RFQ (optional)</Label>
                <Select value={String(form.rfqId)} onValueChange={v => setForm(f => ({ ...f, rfqId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select RFQ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {rfqs.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.rfqNumber}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Supplier *</Label>
                <Select value={String(form.supplierId)} onValueChange={v => setForm(f => ({ ...f, supplierId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Supplier Quotation Ref</Label>
                <Input value={form.supplierQuotationRef} onChange={e => setForm(f => ({ ...f, supplierQuotationRef: e.target.value }))} placeholder="e.g. Q-2024-001" />
              </div>
              <div>
                <Label>Quotation Date</Label>
                <Input type="date" value={form.quotationDate} onChange={e => setForm(f => ({ ...f, quotationDate: e.target.value }))} />
              </div>
              <div>
                <Label>Delivery Time</Label>
                <Input value={form.deliveryTime} onChange={e => setForm(f => ({ ...f, deliveryTime: e.target.value }))} placeholder="e.g. 2 weeks" />
              </div>
              <div>
                <Label>Payment Terms</Label>
                <Input value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} />
              </div>
              <div>
                <Label>Warranty</Label>
                <Input value={form.warranty} onChange={e => setForm(f => ({ ...f, warranty: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }))}>
                  <Plus className="w-3 h-3 mr-1" />Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3"><Input placeholder="Item name" value={item.itemName} onChange={e => updateItem(i, "itemName", e.target.value)} /></div>
                    <div className="col-span-1"><Input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, "quantity", parseFloat(e.target.value) || 0)} /></div>
                    <div className="col-span-1"><Input placeholder="Unit" value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} /></div>
                    <div className="col-span-2"><Input type="number" placeholder="Unit Price" value={item.unitPrice} onChange={e => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)} /></div>
                    <div className="col-span-2"><Input type="number" placeholder="VAT Amt" value={item.vat} onChange={e => updateItem(i, "vat", parseFloat(e.target.value) || 0)} /></div>
                    <div className="col-span-2"><Input readOnly value={`AED ${fmt(item.unitPrice * item.quantity + item.vat)}`} className="bg-muted" /></div>
                    <div className="col-span-1"><Button variant="ghost" size="sm" className="text-red-500" onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))} disabled={form.items.length === 1}><X className="w-4 h-4" /></Button></div>
                  </div>
                ))}
              </div>
              <div className="text-right mt-2 text-sm font-semibold text-[#0f2d5a] dark:text-white">
                Total: AED {fmt(calcTotals(form.items).total)}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} className="bg-[#1e6ab0] hover:bg-[#0f2d5a]" disabled={createSq.isPending || updateSq.isPending}>
              {editingId ? "Save Changes" : "Record Quotation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Select Winner Dialog */}
      <Dialog open={selectDialog !== null} onOpenChange={() => setSelectDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-green-700">Select Winning Quotation</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">You are selecting <strong>{selectDialog?.sqNumber}</strong> as the winning quotation. Other quotations for the same RFQ will be marked as rejected.</p>
          <div className="mt-2">
            <Label>Selection Reason (optional)</Label>
            <Textarea value={selectReason} onChange={e => setSelectReason(e.target.value)} rows={2} placeholder="e.g. Best price and delivery timeline" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectDialog(null)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => selectDialog && selectSq.mutate({ id: selectDialog.id, data: { reason: selectReason } as any })} disabled={selectSq.isPending}>
              Confirm Selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectId !== null} onOpenChange={() => setRejectId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Quotation</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to reject this quotation?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectId && rejectSq.mutate({ id: rejectId })} disabled={rejectSq.isPending}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Quotation</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteSq.mutate({ id: deleteId })} disabled={deleteSq.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
