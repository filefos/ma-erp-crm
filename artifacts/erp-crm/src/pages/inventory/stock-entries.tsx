import { useState } from "react";
import { useListStockEntries, useCreateStockEntry, useListInventoryItems } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowUp, ArrowDown } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useQueryClient } from "@tanstack/react-query";
import { getListStockEntriesQueryKey, getListInventoryItemsQueryKey } from "@workspace/api-client-react";

const typeColors: Record<string, string> = {
  stock_in: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  stock_out: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  material_return: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  adjustment: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

export function StockEntriesList() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "stock_in", itemId: "", quantity: "", reference: "", notes: "" });
  const queryClient = useQueryClient();
  const { data: entries, isLoading } = useListStockEntries();
  const { data: items } = useListInventoryItems();
  const { filterByCompany } = useActiveCompany();
  const filtered = filterByCompany(entries ?? []);
  const create = useCreateStockEntry({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListStockEntriesQueryKey() }); queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() }); setOpen(false); } } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Entries</h1>
          <p className="text-muted-foreground">Log all stock movements — in, out, returns and adjustments.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={filtered as Record<string, unknown>[]}
            columns={[
              { header: "Date", key: "date" },
              { header: "Type", key: "type" },
              { header: "Item", key: "itemName" },
              { header: "Quantity", key: "quantity" },
              { header: "Reference", key: "reference" },
              { header: "Notes", key: "notes" },
            ]}
            filename="stock-entries"
            title="Stock Entries"
          />
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"><Plus className="w-4 h-4 mr-2" />New Entry</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Stock Entry</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Type *</Label>
                  <Select value={form.type} onValueChange={v => setForm(p => ({...p, type: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stock_in">Stock In</SelectItem>
                      <SelectItem value="stock_out">Stock Out</SelectItem>
                      <SelectItem value="material_return">Material Return</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Item *</Label>
                  <Select value={form.itemId} onValueChange={v => setForm(p => ({...p, itemId: v}))}>
                    <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>{items?.map(i => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Quantity *</Label><Input type="number" value={form.quantity} onChange={e => setForm(p => ({...p, quantity: e.target.value}))} /></div>
                <div className="space-y-1"><Label>Reference</Label><Input value={form.reference} onChange={e => setForm(p => ({...p, reference: e.target.value}))} placeholder="PO No. / Project No." /></div>
              </div>
              <div className="space-y-1"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} /></div>
              <Button onClick={() => create.mutate({ data: { ...form, itemId: parseInt(form.itemId,10), quantity: parseFloat(form.quantity)||0 } as any })} disabled={!form.itemId || !form.quantity || create.isPending}>
                {create.isPending ? "Saving..." : "Create Entry"}
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
              <TableHead>Entry No.</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No stock entries found.</TableCell></TableRow> :
            filtered.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs text-primary">{e.entryNumber}</TableCell>
                <TableCell><Badge variant="secondary" className={typeColors[e.type] ?? ""}>{e.type?.replace("_"," ")}</Badge></TableCell>
                <TableCell>{e.itemName || `#${e.itemId}`}</TableCell>
                <TableCell className={`text-right font-medium ${["stock_out"].includes(e.type) ? "text-red-600" : "text-green-600"}`}>{["stock_out"].includes(e.type) ? "-" : "+"}{e.quantity}</TableCell>
                <TableCell>{e.reference || "-"}</TableCell>
                <TableCell>{e.createdByName || "-"}</TableCell>
                <TableCell>{new Date(e.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
