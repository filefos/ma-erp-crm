import { useState } from "react";
import { useListInventoryItems, useCreateInventoryItem } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, AlertTriangle } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";
import { getListInventoryItemsQueryKey } from "@workspace/api-client-react";

const CATEGORIES = ["Steel & Structure","Insulation","Windows & Doors","Roofing","Electrical","Plumbing","Civil","Fixtures","Hardware","Other"];

export function InventoryItemsList() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Steel & Structure", unit: "nos", openingStock: "0", minimumStock: "0", unitCost: "0", warehouseLocation: "" });
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useListInventoryItems({ search: search || undefined, category: category === "all" ? undefined : category });
  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(items ?? []);
  const create = useCreateInventoryItem({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() }); setOpen(false); } } });

  const lowStockCount = items?.filter(i => i.currentStock <= i.minimumStock).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Items</h1>
          <p className="text-muted-foreground">Warehouse stock and material inventory.</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportMenu
            data={filtered as unknown as Record<string, unknown>[]}
            columns={[
              { header: "Item Name", key: "name" },
              { header: "Category", key: "category" },
              { header: "Unit", key: "unit" },
              { header: "Quantity", key: "quantity" },
              { header: "Min Stock", key: "minStockLevel" },
              { header: "Location", key: "location" },
              { header: "Cost (AED)", key: "unitCost", format: v => Number(v ?? 0).toFixed(2) },
            ]}
            filename="inventory-items"
            title="Inventory Items"
            size="sm"
          />
          {lowStockCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400">
              <AlertTriangle className="w-4 h-4" />
              {lowStockCount} low stock
            </div>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Add Item</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Inventory Item</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1 col-span-2"><Label>Item Name *</Label><Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Category *</Label>
                  <Select value={form.category} onValueChange={v => setForm(p => ({...p, category: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Unit</Label><Input value={form.unit} onChange={e => setForm(p => ({...p, unit: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Opening Stock</Label><Input type="number" value={form.openingStock} onChange={e => setForm(p => ({...p, openingStock: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Minimum Stock</Label><Input type="number" value={form.minimumStock} onChange={e => setForm(p => ({...p, minimumStock: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Unit Cost (AED)</Label><Input type="number" value={form.unitCost} onChange={e => setForm(p => ({...p, unitCost: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Location</Label><Input value={form.warehouseLocation} onChange={e => setForm(p => ({...p, warehouseLocation: e.target.value}))} /></div>
              </div>
              <Button className="mt-4" onClick={() => create.mutate({ data: { ...form, openingStock: parseFloat(form.openingStock)||0, minimumStock: parseFloat(form.minimumStock)||0, unitCost: parseFloat(form.unitCost)||0 } as any })} disabled={!form.name || create.isPending}>
                {create.isPending ? "Saving..." : "Add Item"}
              </Button>
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
              <TableHead>Item Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Current Stock</TableHead>
              <TableHead className="text-right">Min Stock</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No inventory items found.</TableCell></TableRow> :
            filtered.map(item => {
              const isLow = item.currentStock <= item.minimumStock;
              return (
                <TableRow key={item.id} className={isLow ? "bg-red-50/50 dark:bg-red-900/10" : ""}>
                  <TableCell className="font-mono text-xs">{item.itemCode}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category}</TableCell>
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
