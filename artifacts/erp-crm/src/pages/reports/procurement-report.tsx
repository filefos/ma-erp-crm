import { useListPurchaseOrders, useListPurchaseRequests, useListSuppliers } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, PieChart } from "lucide-react";

const poStatusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-800",
  confirmed: "bg-purple-100 text-purple-800",
  partial: "bg-orange-100 text-orange-800",
  received: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const prStatusColors: Record<string, string> = {
  pending: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  ordered: "bg-blue-100 text-blue-800",
};

export function ProcurementReport() {
  const { data: orders, isLoading } = useListPurchaseOrders();
  const { data: requests } = useListPurchaseRequests();
  const { data: suppliers } = useListSuppliers();

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading report...</div>;

  const totalOrders = orders?.length ?? 0;
  const totalSpend = orders?.filter(o => ["confirmed","received"].includes(o.status)).reduce((s, o) => s + (o.total ?? 0), 0) ?? 0;
  const pendingPRs = requests?.filter(r => r.status === "pending").length ?? 0;
  const activeSuppliers = suppliers?.filter(s => s.isActive).length ?? 0;

  const bySupplier: Record<string, { name: string; count: number; value: number }> = {};
  orders?.forEach(po => {
    const key = String((po as any).supplierId ?? "unknown");
    const name = (po as any).supplierName ?? `Supplier #${key}`;
    if (!bySupplier[key]) bySupplier[key] = { name, count: 0, value: 0 };
    bySupplier[key].count += 1;
    bySupplier[key].value += po.total ?? 0;
  });

  const byStatus = ["draft","sent","confirmed","partial","received","cancelled"].map(status => ({
    status,
    count: orders?.filter(o => o.status === status).length ?? 0,
    value: orders?.filter(o => o.status === status).reduce((s, o) => s + (o.total ?? 0), 0) ?? 0,
  }));

  const sortedSuppliers = Object.entries(bySupplier).sort(([,a],[,b]) => b.value - a.value);
  const maxSupplierValue = Math.max(...sortedSuppliers.map(([,s]) => s.value), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link href="/reports"><ArrowLeft className="w-4 h-4 mr-1" />Reports</Link></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase & Procurement Report</h1>
          <p className="text-muted-foreground text-sm">Purchase orders, supplier spending, and procurement analysis.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total POs", value: totalOrders, color: "text-foreground" },
          { label: "Total Spend (AED)", value: `${(totalSpend/1000).toFixed(0)}K`, color: "text-blue-600" },
          { label: "Pending PRs", value: pendingPRs, color: "text-orange-600" },
          { label: "Active Suppliers", value: activeSuppliers, color: "text-green-600" },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-xl p-5">
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><PieChart className="w-4 h-4 text-primary" />PO Status Breakdown</h2>
          {byStatus.filter(s => s.count > 0).map(s => (
            <div key={s.status} className="flex items-center justify-between py-2 border-b last:border-0">
              <Badge variant="secondary" className={poStatusColors[s.status] ?? ""}>{s.status}</Badge>
              <div className="text-right">
                <span className="font-semibold">{s.count} POs</span>
                {s.value > 0 && <div className="text-xs text-muted-foreground">AED {s.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>}
              </div>
            </div>
          ))}
          {byStatus.every(s => s.count === 0) && <p className="text-sm text-muted-foreground">No purchase orders found.</p>}
        </div>

        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">Top Suppliers by Spend</h2>
          {sortedSuppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No supplier data.</p>
          ) : sortedSuppliers.slice(0, 8).map(([key, supplier]) => (
            <div key={key} className="flex items-center gap-3">
              <div className="text-sm w-28 shrink-0 truncate text-muted-foreground" title={supplier.name}>{supplier.name}</div>
              <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                <div className="h-full bg-primary/60 rounded" style={{ width: `${(supplier.value / maxSupplierValue) * 100}%` }} />
              </div>
              <div className="text-xs font-medium w-20 text-right">AED {(supplier.value/1000).toFixed(0)}K</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Purchase Requests Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["pending","approved","rejected","ordered"].map(status => {
            const count = requests?.filter(r => r.status === status).length ?? 0;
            return (
              <div key={status} className="border rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{count}</div>
                <Badge variant="secondary" className={`${prStatusColors[status] ?? ""} mt-1 capitalize`}>{status}</Badge>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b"><h2 className="font-semibold">Recent Purchase Orders</h2></div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-3 font-medium">PO Number</th>
              <th className="text-left p-3 font-medium">Supplier</th>
              <th className="text-left p-3 font-medium">Delivery Date</th>
              <th className="text-left p-3 font-medium">Payment Terms</th>
              <th className="text-right p-3 font-medium">Total (AED)</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders?.slice(0, 15).map(po => (
              <tr key={po.id} className="border-t hover:bg-muted/20">
                <td className="p-3 font-mono font-medium text-primary">{po.poNumber}</td>
                <td className="p-3">{(po as any).supplierName || "-"}</td>
                <td className="p-3 text-muted-foreground">{po.deliveryDate || "-"}</td>
                <td className="p-3 text-muted-foreground">{po.paymentTerms || "-"}</td>
                <td className="p-3 text-right font-medium">AED {(po.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-3"><Badge variant="secondary" className={poStatusColors[po.status] ?? ""}>{po.status}</Badge></td>
              </tr>
            ))}
            {(orders?.length ?? 0) === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No purchase orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
