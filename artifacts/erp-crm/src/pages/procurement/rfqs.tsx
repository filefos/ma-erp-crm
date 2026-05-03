import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListRfqs, useCreateRfq, useUpdateRfq, useDeleteRfq, useSendRfq, useCloseRfq, useListPurchaseRequests, useListSuppliers, useListCompanies } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Send, X, Trash2, Edit, ChevronDown, ChevronUp } from "lucide-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  quotation_received: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  closed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

interface RfqItem { itemName: string; quantity: number; unit: string; specifications: string; }

const EMPTY_ITEM: RfqItem = { itemName: "", quantity: 1, unit: "", specifications: "" };

export function RfqsList() {
  const { activeCompanyId } = useActiveCompany();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [actionDialog, setActionDialog] = useState<{ type: "send" | "close"; id: number } | null>(null);

  const [form, setForm] = useState({
    companyId: activeCompanyId,
    purchaseRequestId: "" as string | number,
    requiredDeliveryDate: "",
    paymentTerms: "",
    notes: "",
    supplierIds: [] as number[],
    items: [{ ...EMPTY_ITEM }] as RfqItem[],
  });

  const { data: rfqs = [], isLoading } = useListRfqs({ companyId: activeCompanyId });
  const { data: prs = [] } = useListPurchaseRequests({ status: "approved", companyId: activeCompanyId });
  const { data: rawSuppliers = [] } = useListSuppliers();
  const { filterByCompany } = useActiveCompany();
  const suppliers = filterByCompany(rawSuppliers);
  const { data: companies = [] } = useListCompanies();

  const createRfq = useCreateRfq({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/rfqs"] }); setDialogOpen(false); toast.success("RFQ created"); } } });
  const updateRfq = useUpdateRfq({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/rfqs"] }); setDialogOpen(false); toast.success("RFQ updated"); } } });
  const deleteRfq = useDeleteRfq({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/rfqs"] }); setDeleteId(null); toast.success("RFQ deleted"); } } });
  const sendRfq = useSendRfq({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/rfqs"] }); setActionDialog(null); toast.success("RFQ marked as sent"); } } });
  const closeRfq = useCloseRfq({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["/rfqs"] }); setActionDialog(null); toast.success("RFQ closed"); } } });

  const filtered = rfqs.filter(r => {
    const ms = !search || r.rfqNumber.toLowerCase().includes(search.toLowerCase()) || (r as any).prNumber?.toLowerCase().includes(search.toLowerCase());
    const mst = statusFilter === "all" || r.status === statusFilter;
    return ms && mst;
  });

  function openCreate() {
    setEditingId(null);
    setForm({ companyId: activeCompanyId, purchaseRequestId: "", requiredDeliveryDate: "", paymentTerms: "", notes: "", supplierIds: [], items: [{ ...EMPTY_ITEM }] });
    setDialogOpen(true);
  }

  function openEdit(r: any) {
    setEditingId(r.id);
    setForm({
      companyId: r.companyId,
      purchaseRequestId: r.purchaseRequestId ?? "",
      requiredDeliveryDate: r.requiredDeliveryDate ?? "",
      paymentTerms: r.paymentTerms ?? "",
      notes: r.notes ?? "",
      supplierIds: r.supplierIds ?? [],
      items: r.items?.length ? r.items : [{ ...EMPTY_ITEM }],
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    const payload = {
      ...form,
      companyId: Number(form.companyId),
      purchaseRequestId: form.purchaseRequestId ? Number(form.purchaseRequestId) : undefined,
      items: form.items.filter(i => i.itemName.trim()),
    };
    if (editingId) updateRfq.mutate({ id: editingId, data: payload as any });
    else createRfq.mutate({ data: payload as any });
  }

  function toggleSupplier(sid: number) {
    setForm(f => ({
      ...f,
      supplierIds: f.supplierIds.includes(sid) ? f.supplierIds.filter(x => x !== sid) : [...f.supplierIds, sid],
    }));
  }

  function addItem() { setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] })); }
  function removeItem(i: number) { setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) })); }
  function updateItem(i: number, k: keyof RfqItem, v: string | number) {
    setForm(f => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [k]: v } : item) }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0f2d5a] dark:text-white">Requests for Quotation</h1>
          <p className="text-muted-foreground text-sm">{rfqs.length} RFQs · Send to suppliers to collect quotes</p>
        </div>
        <Button onClick={openCreate} className="bg-[#1e6ab0] hover:bg-[#0f2d5a]">
          <Plus className="w-4 h-4 mr-2" />New RFQ
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search RFQs…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="quotation_received">Quotation Received</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No RFQs found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Card key={r.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-sm text-[#0f2d5a] dark:text-white">{r.rfqNumber}</span>
                        <Badge className={STATUS_COLORS[r.status] ?? ""}>{r.status.replace("_", " ")}</Badge>
                        {(r as any).prNumber && <Badge variant="outline" className="text-xs">PR: {(r as any).prNumber}</Badge>}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                        {r.requiredDeliveryDate && <span>Delivery: {r.requiredDeliveryDate}</span>}
                        {(r as any).suppliers?.length > 0 && <span>{(r as any).suppliers.length} suppliers</span>}
                        {r.items && (r.items as any[]).length > 0 && <span>{(r.items as any[]).length} items</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {r.status === "draft" && (
                      <Button size="sm" variant="outline" className="text-blue-600 border-blue-300" onClick={() => setActionDialog({ type: "send", id: r.id })}>
                        <Send className="w-3 h-3 mr-1" />Send
                      </Button>
                    )}
                    {r.status === "sent" && (
                      <Button size="sm" variant="outline" className="text-green-600 border-green-300" onClick={() => setActionDialog({ type: "close", id: r.id })}>
                        Close
                      </Button>
                    )}
                    {["draft", "sent"].includes(r.status) && (
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Edit className="w-4 h-4" /></Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteId(r.id)}><Trash2 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                      {expandedId === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                {expandedId === r.id && (
                  <div className="mt-3 pt-3 border-t space-y-3">
                    {(r as any).suppliers?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">SUPPLIERS</p>
                        <div className="flex flex-wrap gap-2">
                          {(r as any).suppliers.map((s: any) => (
                            <Badge key={s.id} variant="outline">{s.name}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {r.items && (r.items as any[]).length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">ITEMS</p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Item</TableHead>
                              <TableHead className="text-xs">Qty</TableHead>
                              <TableHead className="text-xs">Unit</TableHead>
                              <TableHead className="text-xs">Specs</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(r.items as any[]).map((item, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-sm">{item.itemName}</TableCell>
                                <TableCell className="text-sm">{item.quantity}</TableCell>
                                <TableCell className="text-sm">{item.unit}</TableCell>
                                <TableCell className="text-sm">{item.specifications || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    {r.notes && <p className="text-sm text-muted-foreground">{r.notes}</p>}
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
            <DialogTitle className="text-[#0f2d5a] dark:text-white">{editingId ? "Edit RFQ" : "New RFQ"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Company</Label>
                <Select value={String(form.companyId)} onValueChange={v => setForm(f => ({ ...f, companyId: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Linked PR (optional)</Label>
                <Select value={String(form.purchaseRequestId)} onValueChange={v => setForm(f => ({ ...f, purchaseRequestId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select PR" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {prs.map((pr: any) => <SelectItem key={pr.id} value={String(pr.id)}>{pr.prNumber} — {pr.description?.substring(0, 40)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Required Delivery Date</Label>
                <Input type="date" value={form.requiredDeliveryDate} onChange={e => setForm(f => ({ ...f, requiredDeliveryDate: e.target.value }))} />
              </div>
              <div>
                <Label>Payment Terms</Label>
                <Input value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} placeholder="e.g. Net 30" />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
            </div>

            {/* Suppliers */}
            <div>
              <Label className="text-sm font-medium">Select Suppliers to Invite</Label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto border rounded-lg p-2">
                {suppliers.map(s => (
                  <label key={s.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm transition-colors ${form.supplierIds.includes(s.id) ? "bg-blue-50 text-blue-700 dark:bg-blue-950" : "hover:bg-muted"}`}>
                    <input type="checkbox" checked={form.supplierIds.includes(s.id)} onChange={() => toggleSupplier(s.id)} className="accent-[#1e6ab0]" />
                    {s.name}
                  </label>
                ))}
              </div>
              {form.supplierIds.length > 0 && <p className="text-xs text-muted-foreground mt-1">{form.supplierIds.length} supplier(s) selected</p>}
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Items / Scope of Supply</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Add Item</Button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-4">
                      <Input placeholder="Item name" value={item.itemName} onChange={e => updateItem(i, "itemName", e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, "quantity", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-2">
                      <Input placeholder="Unit" value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} />
                    </div>
                    <div className="col-span-3">
                      <Input placeholder="Specifications" value={item.specifications} onChange={e => updateItem(i, "specifications", e.target.value)} />
                    </div>
                    <div className="col-span-1">
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => removeItem(i)} disabled={form.items.length === 1}><X className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} className="bg-[#1e6ab0] hover:bg-[#0f2d5a]" disabled={createRfq.isPending || updateRfq.isPending}>
              {editingId ? "Save Changes" : "Create RFQ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialogs */}
      <Dialog open={actionDialog !== null} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog?.type === "send" ? "Mark RFQ as Sent" : "Close RFQ"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {actionDialog?.type === "send"
              ? "This will mark the RFQ as sent to suppliers. You can still edit it afterwards."
              : "Closing this RFQ means no more quotations will be accepted."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button className="bg-[#1e6ab0] hover:bg-[#0f2d5a]" onClick={() => {
              if (!actionDialog) return;
              if (actionDialog.type === "send") sendRfq.mutate({ id: actionDialog.id });
              else closeRfq.mutate({ id: actionDialog.id });
            }}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete RFQ</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteRfq.mutate({ id: deleteId })} disabled={deleteRfq.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
