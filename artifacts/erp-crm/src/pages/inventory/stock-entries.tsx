import { useState, useMemo } from "react";
import { useListStockEntries, useCreateStockEntry, useListInventoryItems } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowLeftRight, ImagePlus, Loader2, X, Package } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { BulkUploadDialog } from "@/components/BulkUploadDialog";
import { useQueryClient } from "@tanstack/react-query";
import { getListStockEntriesQueryKey, getListInventoryItemsQueryKey, createStockEntry } from "@workspace/api-client-react";
import { uploadFile } from "@/lib/upload";

const typeColors: Record<string, string> = {
  stock_in: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  stock_out: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  material_return: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  adjustment: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

const EMPTY_FORM = {
  type: "stock_in", itemId: "", quantity: "",
  unitCost: "", reference: "", notes: "", imageUrl: "",
};

export function StockEntriesList() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const { data: entries, isLoading } = useListStockEntries();
  const { data: items } = useListInventoryItems();
  const { filterByCompany, activeCompanyId } = useActiveCompany();
  const filtered = filterByCompany(entries ?? []);
  const create = useCreateStockEntry({ mutation: { onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: getListStockEntriesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
    setForm(EMPTY_FORM);
    setOpen(false);
  } } });

  const selectedItem = useMemo(() => (items ?? []).find(i => String(i.id) === form.itemId), [items, form.itemId]);
  const qty = parseFloat(form.quantity) || 0;
  const cost = parseFloat(form.unitCost) || (selectedItem?.unitCost ?? 0);
  const totalValue = qty * cost;

  function pickItem(id: string) {
    const it = (items ?? []).find(i => String(i.id) === id);
    setForm(p => ({
      ...p,
      itemId: id,
      unitCost: p.unitCost || (it?.unitCost != null ? String(it.unitCost) : ""),
      imageUrl: p.imageUrl || (it?.imageUrl ?? ""),
    }));
  }

  async function handleImage(file: File) {
    setUploading(true);
    try {
      const r = await uploadFile(file);
      setForm(p => ({ ...p, imageUrl: r.objectKey }));
    } catch (err: any) {
      alert(`Upload failed: ${err?.message ?? err}`);
    } finally { setUploading(false); }
  }

  function submit() {
    create.mutate({ data: {
      type: form.type,
      itemId: parseInt(form.itemId, 10),
      quantity: qty,
      unitCost: cost || undefined,
      reference: form.reference || undefined,
      notes: form.notes || undefined,
      imageUrl: form.imageUrl || undefined,
      companyId: activeCompanyId,
    } as any });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Entries</h1>
          <p className="text-muted-foreground">Log all stock movements — in, out, returns and adjustments.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={filtered}
            columns={[
              { header: "Date", key: "createdAt" },
              { header: "Type", key: "type" },
              { header: "Item", key: "itemName" },
              { header: "Quantity", key: "quantity" },
              { header: "Unit Cost", key: "unitCost" },
              { header: "Reference", key: "reference" },
              { header: "Notes", key: "notes" },
            ]}
            filename="stock-entries"
            title="Stock Entries"
          />
          <BulkUploadDialog
            title="Bulk Upload Stock Entries"
            description="Upload a CSV or Excel file with one stock movement per row. Item names must match an existing inventory item exactly."
            templateFilename="stock-entries-template.xlsx"
            columns={[
              { key: "type", label: "Type", required: true, example: "stock_in" },
              { key: "itemName", label: "Item Name", required: true, example: "GI Sheet 0.5mm" },
              { key: "quantity", label: "Quantity", required: true, example: 100 },
              { key: "unitCost", label: "Unit Cost (AED)", example: 12.5 },
              { key: "reference", label: "Reference", example: "PO-2026-0001" },
              { key: "notes", label: "Notes", example: "" },
            ]}
            onRow={async (row) => {
              const itemName = (row["Item Name"] || "").trim().toLowerCase();
              const item = (items ?? []).find(i => i.name.trim().toLowerCase() === itemName);
              if (!item) throw new Error(`Item "${row["Item Name"]}" not found`);
              const type = (row["Type"] || "stock_in").trim();
              if (!["stock_in", "stock_out", "material_return", "adjustment"].includes(type)) {
                throw new Error(`Invalid type "${type}" — use stock_in, stock_out, material_return or adjustment`);
              }
              await createStockEntry({
                type,
                itemId: item.id,
                quantity: parseFloat(row["Quantity"] || "0") || 0,
                unitCost: parseFloat(row["Unit Cost (AED)"] || "0") || undefined,
                reference: row["Reference"] || "",
                notes: row["Notes"] || "",
                companyId: activeCompanyId,
              } as any);
            }}
            onComplete={() => {
              queryClient.invalidateQueries({ queryKey: getListStockEntriesQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
            }}
          />
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(EMPTY_FORM); }}>
            <DialogTrigger asChild>
              <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Plus className="w-4 h-4 mr-2" />New Entry</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-md bg-[#0f2d5a] text-white"><ArrowLeftRight className="w-4 h-4" /></div>
                  <DialogTitle>New Stock Entry</DialogTitle>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-3">
                <div className="md:col-span-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Material Photo</Label>
                  <div className="mt-1 aspect-square rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-center relative overflow-hidden">
                    {form.imageUrl ? (
                      <>
                        <img src={form.imageUrl} alt="material" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setForm(p => ({...p, imageUrl: ""}))} className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"><X className="w-3.5 h-3.5" /></button>
                      </>
                    ) : (
                      <label className="flex flex-col items-center gap-2 cursor-pointer p-4 text-center">
                        {uploading ? <Loader2 className="w-8 h-8 text-[#1e6ab0] animate-spin" /> : <ImagePlus className="w-8 h-8 text-slate-400" />}
                        <span className="text-xs text-muted-foreground">{uploading ? "Uploading…" : "Attach photo of material / delivery note"}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }} data-testid="input-stock-image" />
                      </label>
                    )}
                  </div>

                  {selectedItem && (
                    <div className="mt-3 rounded-lg border bg-slate-50 dark:bg-slate-900/40 p-2.5 text-xs space-y-1">
                      <div className="font-semibold text-[#0f2d5a] dark:text-[#1e6ab0] flex items-center gap-1.5"><Package className="w-3.5 h-3.5" />{selectedItem.itemCode}</div>
                      {selectedItem.brand && <div><span className="text-muted-foreground">Brand:</span> {selectedItem.brand}</div>}
                      {selectedItem.country && <div><span className="text-muted-foreground">Country:</span> {selectedItem.country}</div>}
                      {selectedItem.color && <div><span className="text-muted-foreground">Color:</span> {selectedItem.color}</div>}
                      <div><span className="text-muted-foreground">In stock:</span> {selectedItem.currentStock} {selectedItem.unit}</div>
                    </div>
                  )}
                </div>

                <div className="md:col-span-2 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Type *</Label>
                      <Select value={form.type} onValueChange={v => setForm(p => ({...p, type: v}))}>
                        <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stock_in">Stock In</SelectItem>
                          <SelectItem value="stock_out">Stock Out</SelectItem>
                          <SelectItem value="material_return">Material Return</SelectItem>
                          <SelectItem value="adjustment">Adjustment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Item *</Label>
                      <Select value={form.itemId} onValueChange={pickItem}>
                        <SelectTrigger data-testid="select-item"><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent className="max-h-72">{items?.map(i => <SelectItem key={i.id} value={String(i.id)}>{i.name}{i.brand ? ` · ${i.brand}` : ""}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1 col-span-2">
                      <Label>Description</Label>
                      <Input
                        value={selectedItem?.description || ""}
                        readOnly
                        placeholder="Auto-filled from selected item"
                        className="bg-slate-50 dark:bg-slate-900/40"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Reference</Label>
                      <Input value={form.reference} onChange={e => setForm(p => ({...p, reference: e.target.value}))} placeholder="PO No. / DN No. / Project" data-testid="input-reference" />
                    </div>
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Input value={selectedItem?.category || ""} readOnly className="bg-slate-50 dark:bg-slate-900/40" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Notes</Label>
                    <Textarea rows={2} value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Anything else relevant…" data-testid="input-notes" />
                  </div>
                </div>

                {/* Numeric panel */}
                <div className="md:col-span-3 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 p-3 border">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity ({selectedItem?.unit || "unit"})</Label>
                    <Input type="number" value={form.quantity} onChange={e => setForm(p => ({...p, quantity: e.target.value}))} data-testid="input-qty" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit Cost (AED)</Label>
                    <Input type="number" value={form.unitCost} onChange={e => setForm(p => ({...p, unitCost: e.target.value}))} placeholder={selectedItem ? String(selectedItem.unitCost ?? 0) : "0.00"} data-testid="input-unit-cost" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Total Value (AED)</Label>
                    <div className="h-10 px-3 flex items-center rounded-md border bg-white dark:bg-slate-950 font-semibold text-[#0f2d5a] dark:text-[#1e6ab0]" data-testid="text-total-value">
                      {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  onClick={submit}
                  disabled={!form.itemId || !form.quantity || create.isPending || uploading}
                  className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
                  data-testid="button-create-entry"
                >
                  {create.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Create Entry"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Entry No.</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered.length === 0 ? <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No stock entries found.</TableCell></TableRow> :
            filtered.map((e: any) => {
              const isOut = ["stock_out"].includes(e.type);
              const total = (e.quantity || 0) * (e.unitCost || 0);
              return (
                <TableRow key={e.id}>
                  <TableCell>
                    {e.imageUrl
                      ? <img src={e.imageUrl} alt="" className="w-9 h-9 rounded object-cover border" />
                      : <div className="w-9 h-9 rounded bg-slate-100 dark:bg-slate-800 border" />}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-primary">{e.entryNumber}</TableCell>
                  <TableCell><Badge variant="secondary" className={typeColors[e.type] ?? ""}>{e.type?.replace("_"," ")}</Badge></TableCell>
                  <TableCell>{e.itemName || `#${e.itemId}`}</TableCell>
                  <TableCell className={`text-right font-medium ${isOut ? "text-red-600" : "text-green-600"}`}>{isOut ? "-" : "+"}{e.quantity}</TableCell>
                  <TableCell className="text-right">{e.unitCost ? `AED ${Number(e.unitCost).toFixed(2)}` : "-"}</TableCell>
                  <TableCell className="text-right font-medium">{total ? `AED ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}</TableCell>
                  <TableCell>{e.reference || "-"}</TableCell>
                  <TableCell>{e.createdByName || "-"}</TableCell>
                  <TableCell>{new Date(e.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
