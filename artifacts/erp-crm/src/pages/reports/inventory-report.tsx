import { useListInventoryItems, useListStockEntries } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Package, AlertTriangle } from "lucide-react";

export function InventoryReport() {
  const { data: items, isLoading } = useListInventoryItems();
  const { data: entries } = useListStockEntries();

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading report...</div>;

  const totalItems = items?.length ?? 0;
  const lowStock = items?.filter(i => i.currentStock <= i.minimumStock) ?? [];
  const inStock = items?.filter(i => i.currentStock > i.minimumStock) ?? [];
  const totalStockValue = items?.reduce((s, i) => s + (i.currentStock * (i.unitCost ?? 0)), 0) ?? 0;

  const byCategory: Record<string, { count: number; value: number }> = {};
  items?.forEach(i => {
    if (!byCategory[i.category]) byCategory[i.category] = { count: 0, value: 0 };
    byCategory[i.category].count += 1;
    byCategory[i.category].value += i.currentStock * (i.unitCost ?? 0);
  });

  const recentEntries = entries?.slice(0, 10) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link href="/reports"><ArrowLeft className="w-4 h-4 mr-1" />Reports</Link></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Stock Report</h1>
          <p className="text-muted-foreground text-sm">Current stock levels, low stock items, and movement history.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Items", value: totalItems, color: "text-foreground" },
          { label: "In Stock", value: inStock.length, color: "text-green-600" },
          { label: "Low / Out of Stock", value: lowStock.length, color: "text-red-600" },
          { label: "Total Stock Value", value: `AED ${(totalStockValue/1000).toFixed(0)}K`, color: "text-blue-600" },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-xl p-5">
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2 text-red-700 dark:text-red-400"><AlertTriangle className="w-4 h-4" />Low Stock Alert — {lowStock.length} items need reordering</h2>
          <div className="grid md:grid-cols-2 gap-2">
            {lowStock.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-white dark:bg-card border rounded-lg p-3">
                <div>
                  <div className="font-medium text-sm">{item.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{item.itemCode}</div>
                </div>
                <div className="text-right">
                  <div className="text-red-600 font-bold">{item.currentStock} {item.unit}</div>
                  <div className="text-xs text-muted-foreground">Min: {item.minimumStock}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Package className="w-4 h-4 text-primary" />By Category</h2>
          {Object.entries(byCategory).sort(([,a],[,b]) => b.value - a.value).map(([cat, data]) => (
            <div key={cat} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm font-medium">{cat}</span>
              <div className="text-right">
                <div className="text-sm font-semibold">{data.count} items</div>
                <div className="text-xs text-muted-foreground">AED {data.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">Recent Stock Movements</h2>
          {recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock movements recorded.</p>
          ) : recentEntries.map((e: any) => (
            <div key={e.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
              <div>
                <div className="text-sm font-medium">{e.itemName || `Item #${e.itemId}`}</div>
                <div className="text-xs text-muted-foreground capitalize">{e.type?.replace("_"," ")} — {new Date(e.createdAt).toLocaleDateString()}</div>
              </div>
              <Badge variant="secondary" className={
                e.type === "stock_in" ? "bg-green-100 text-green-800" :
                e.type === "stock_out" ? "bg-red-100 text-red-800" :
                "bg-orange-100 text-orange-800"
              }>
                {e.type === "stock_out" ? "-" : "+"}{e.quantity}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b"><h2 className="font-semibold">Full Inventory</h2></div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-3 font-medium">Item Code</th>
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Category</th>
              <th className="text-right p-3 font-medium">Current</th>
              <th className="text-right p-3 font-medium">Min</th>
              <th className="text-right p-3 font-medium">Unit Cost</th>
              <th className="text-right p-3 font-medium">Stock Value</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {items?.map(item => {
              const isLow = item.currentStock <= item.minimumStock;
              return (
                <tr key={item.id} className={`border-t hover:bg-muted/20 ${isLow ? "bg-red-50/30 dark:bg-red-900/10" : ""}`}>
                  <td className="p-3 font-mono text-xs">{item.itemCode}</td>
                  <td className="p-3 font-medium">{item.name}</td>
                  <td className="p-3 text-muted-foreground">{item.category}</td>
                  <td className={`p-3 text-right font-medium ${isLow ? "text-red-600" : "text-green-600"}`}>{item.currentStock} {item.unit}</td>
                  <td className="p-3 text-right text-muted-foreground">{item.minimumStock}</td>
                  <td className="p-3 text-right">AED {(item.unitCost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 text-right font-medium">AED {((item.currentStock ?? 0) * (item.unitCost ?? 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="p-3">
                    {isLow
                      ? <Badge variant="secondary" className="bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1" />Low</Badge>
                      : <Badge variant="secondary" className="bg-green-100 text-green-800">OK</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
