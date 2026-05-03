import { useState } from "react";
import { useListInventoryItems, useCreateInventoryItem } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, AlertTriangle, Package, ImagePlus, Loader2, X } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { BulkUploadDialog } from "@/components/BulkUploadDialog";
import { useQueryClient } from "@tanstack/react-query";
import { getListInventoryItemsQueryKey } from "@workspace/api-client-react";
import { createInventoryItem } from "@workspace/api-client-react";
import { uploadFile } from "@/lib/upload";

const CATEGORIES = ["Steel & Structure","Insulation","Windows & Doors","Roofing","Electrical","Plumbing","Civil","Fixtures","Hardware","Other"];
const UNITS = ["nos","pcs","mtr","sqm","cum","kg","ton","ltr","box","roll","set","bag"];

const EMPTY_FORM = {
  name: "", category: "Steel & Structure", unit: "nos",
  description: "", brand: "", country: "", color: "",
  openingStock: "0", minimumStock: "0", unitCost: "0",
  warehouseLocation: "", imageUrl: "",
};

export function InventoryItemsList() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useListInventoryItems({ search: search || undefined, category: category === "all" ? undefined : category });
  const { filterByCompany, activeCompanyId } = useActiveCompany();
  const filtered = filterByCompany(items ?? []);
  const create = useCreateInventoryItem({ mutation: { onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
    setForm(EMPTY_FORM);
    setOpen(false);
  } } });

  const lowStockCount = items?.filter(i => i.currentStock <= i.minimumStock).length ?? 0;
  const qty = parseFloat(form.openingStock) || 0;
  const cost = parseFloat(form.unitCost) || 0;
  const totalValue = qty * cost;

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
      name: form.name, category: form.category, unit: form.unit,
      description: form.description || undefined,
      brand: form.brand || undefined, country: form.country || undefined, color: form.color || undefined,
      openingStock: qty, minimumStock: parseFloat(form.minimumStock) || 0,
      unitCost: cost,
      warehouseLocation: form.warehouseLocation || undefined,
      imageUrl: form.imageUrl || undefined,
      companyId: activeCompanyId,
    } as any });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Items</h1>
          <p className="text-muted-foreground">Warehouse stock and material inventory.</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportMenu
            data={filtered}
            columns={[
              { header: "Item Name", key: "name" },
              { header: "Category", key: "category" },
              { header: "Unit", key: "unit" },
              { header: "Brand", key: "brand" },
              { header: "Country", key: "country" },
              { header: "Color", key: "color" },
              { header: "Quantity", key: "currentStock" },
              { header: "Min Stock", key: "minimumStock" },
              { header: "Location", key: "warehouseLocation" },
              { header: "Cost (AED)", key: "unitCost", format: v => Number(v ?? 0).toFixed(2) },
            ]}
            filename="inventory-items"
            title="Inventory Items"
            size="sm"
          />
          <BulkUploadDialog
            title="Bulk Upload Inventory Items"
            description="Upload a CSV or Excel file with one item per row. Existing items are not updated — duplicates by name will be skipped by the server."
            templateFilename="inventory-items-template.xlsx"
            columns={[
              { key: "name", label: "Item Name", required: true, example: "GI Sheet 0.5mm" },
              { key: "category", label: "Category", required: true, example: "Steel & Structure" },
              { key: "unit", label: "Unit", example: "nos" },
              { key: "description", label: "Description", example: "Galvanised iron roofing sheet" },
              { key: "brand", label: "Brand", example: "Tata" },
              { key: "country", label: "Country", example: "India" },
              { key: "color", label: "Color", example: "Silver" },
              { key: "openingStock", label: "Opening Stock", example: 0 },
              { key: "minimumStock", label: "Minimum Stock", example: 0 },
              { key: "unitCost", label: "Unit Cost (AED)", example: 0 },
              { key: "warehouseLocation", label: "Location", example: "Sajja Yard" },
            ]}
            onRow={async (row) => {
              await createInventoryItem({
                name: row["Item Name"],
                category: row["Category"] || "Other",
                unit: row["Unit"] || "nos",
                description: row["Description"] || undefined,
                brand: row["Brand"] || undefined,
                country: row["Country"] || undefined,
                color: row["Color"] || undefined,
                openingStock: parseFloat(row["Opening Stock"] || "0") || 0,
                minimumStock: parseFloat(row["Minimum Stock"] || "0") || 0,
                unitCost: parseFloat(row["Unit Cost (AED)"] || "0") || 0,
                warehouseLocation: row["Location"] || "",
                companyId: activeCompanyId,
              } as any);
            }}
            onComplete={() => queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() })}
          />
          {lowStockCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400">
              <AlertTriangle className="w-4 h-4" />
              {lowStockCount} low stock
            </div>
          )}
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(EMPTY_FORM); }}>
            <DialogTrigger asChild><Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Plus className="w-4 h-4 mr-2" />Add Item</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-md bg-[#0f2d5a] text-white"><Package className="w-4 h-4" /></div>
                  <DialogTitle>New Inventory Item</DialogTitle>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-3">
                {/* Image upload */}
                <div className="md:col-span-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Product Image</Label>
                  <div className="mt-1 aspect-square rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-center relative overflow-hidden">
                    {form.imageUrl ? (
                      <>
                        <img src={form.imageUrl} alt="product" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setForm(p => ({...p, imageUrl: ""}))} className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80" data-testid="button-clear-image"><X className="w-3.5 h-3.5" /></button>
                      </>
                    ) : (
                      <label className="flex flex-col items-center gap-2 cursor-pointer p-4 text-center">
                        {uploading ? <Loader2 className="w-8 h-8 text-[#1e6ab0] animate-spin" /> : <ImagePlus className="w-8 h-8 text-slate-400" />}
                        <span className="text-xs text-muted-foreground">{uploading ? "Uploading…" : "Click to upload product image"}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }} data-testid="input-product-image" />
                      </label>
                    )}
                  </div>
                </div>

                {/* Right: detail fields */}
                <div className="md:col-span-2 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2">
                      <Label>Item Name *</Label>
                      <Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="e.g. GI Sheet 0.5mm" data-testid="input-name" />
                    </div>
                    <div className="space-y-1">
                      <Label>Category *</Label>
                      <Select value={form.category} onValueChange={v => setForm(p => ({...p, category: v}))}>
                        <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Unit *</Label>
                      <Select value={form.unit} onValueChange={v => setForm(p => ({...p, unit: v}))}>
                        <SelectTrigger data-testid="select-unit"><SelectValue /></SelectTrigger>
                        <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Brand</Label>
                      <Input value={form.brand} onChange={e => setForm(p => ({...p, brand: e.target.value}))} placeholder="e.g. Tata, JSW" data-testid="input-brand" />
                    </div>
                    <div className="space-y-1">
                      <Label>Country of Origin</Label>
                      <Input value={form.country} onChange={e => setForm(p => ({...p, country: e.target.value}))} placeholder="e.g. UAE, India, China" data-testid="input-country" />
                    </div>
                    <div className="space-y-1">
                      <Label>Color</Label>
                      <Input value={form.color} onChange={e => setForm(p => ({...p, color: e.target.value}))} placeholder="e.g. White, RAL 9010" data-testid="input-color" />
                    </div>
                    <div className="space-y-1">
                      <Label>Warehouse Location</Label>
                      <Input value={form.warehouseLocation} onChange={e => setForm(p => ({...p, warehouseLocation: e.target.value}))} placeholder="e.g. Sajja Yard A-3" data-testid="input-location" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Textarea rows={2} value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="Specs, model, finish…" data-testid="input-description" />
                  </div>
                </div>

                {/* Numeric panel — full width */}
                <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 p-3 border">
                  <div className="space-y-1">
                    <Label className="text-xs">Opening Stock (Qty)</Label>
                    <Input type="number" value={form.openingStock} onChange={e => setForm(p => ({...p, openingStock: e.target.value}))} data-testid="input-quantity" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Minimum Stock</Label>
                    <Input type="number" value={form.minimumStock} onChange={e => setForm(p => ({...p, minimumStock: e.target.value}))} data-testid="input-min" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit Cost (AED)</Label>
                    <Input type="number" value={form.unitCost} onChange={e => setForm(p => ({...p, unitCost: e.target.value}))} data-testid="input-cost" />
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
                <Button onClick={submit} disabled={!form.name || create.isPending || uploading} className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" data-testid="button-save">
                  {create.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Add Item"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search items..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14"></TableHead>
              <TableHead>Item Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Current Stock</TableHead>
              <TableHead className="text-right">Min Stock</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered.length === 0 ? <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No inventory items found.</TableCell></TableRow> :
            filtered.map(item => {
              const isLow = item.currentStock <= item.minimumStock;
              return (
                <TableRow key={item.id} className={isLow ? "bg-red-50/50 dark:bg-red-900/10" : ""}>
                  <TableCell>
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt="" className="w-10 h-10 rounded object-cover border" />
                      : <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-800 border flex items-center justify-center"><Package className="w-4 h-4 text-slate-400" /></div>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.itemCode}</TableCell>
                  <TableCell className="font-medium">
                    {item.name}
                    {item.color ? <span className="ml-1.5 text-xs text-muted-foreground">· {item.color}</span> : null}
                  </TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell className="text-sm">{item.brand || "-"}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className={`text-right font-medium ${isLow ? "text-red-600" : "text-green-600"}`}>{item.currentStock}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{item.minimumStock}</TableCell>
                  <TableCell className="text-right">AED {item.unitCost?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{item.warehouseLocation || "-"}</TableCell>
                  <TableCell>
                    {isLow
                      ? <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"><AlertTriangle className="w-3 h-3 mr-1" />Low Stock</Badge>
                      : <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">In Stock</Badge>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
