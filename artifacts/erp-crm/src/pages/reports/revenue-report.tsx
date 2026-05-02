import { useListTaxInvoices } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, BarChart2 } from "lucide-react";

const statusColors: Record<string, string> = {
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  unpaid: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function RevenueReport() {
  const { data: invoices, isLoading } = useListTaxInvoices();

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading report...</div>;

  const totalRevenue = invoices?.reduce((s, i) => s + (i.grandTotal ?? 0), 0) ?? 0;
  const totalPaid = invoices?.reduce((s, i) => s + (i.amountPaid ?? 0), 0) ?? 0;
  const totalOutstanding = invoices?.reduce((s, i) => s + (i.balance ?? 0), 0) ?? 0;
  const paidCount = invoices?.filter(i => i.paymentStatus === "paid").length ?? 0;
  const unpaidCount = invoices?.filter(i => i.paymentStatus === "unpaid").length ?? 0;
  const partialCount = invoices?.filter(i => i.paymentStatus === "partial").length ?? 0;

  const collectionRate = totalRevenue > 0 ? ((totalPaid / totalRevenue) * 100).toFixed(1) : "0";

  const monthlyData: Record<string, number> = {};
  invoices?.forEach(inv => {
    if (!inv.invoiceDate) return;
    const month = inv.invoiceDate.substring(0, 7);
    monthlyData[month] = (monthlyData[month] ?? 0) + (inv.grandTotal ?? 0);
  });
  const sortedMonths = Object.entries(monthlyData).sort(([a], [b]) => b.localeCompare(a)).slice(0, 6);
  const maxMonthly = Math.max(...sortedMonths.map(([, v]) => v), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link href="/reports"><ArrowLeft className="w-4 h-4 mr-1" />Reports</Link></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revenue & Invoice Report</h1>
          <p className="text-muted-foreground text-sm">Invoice totals, outstanding receivables, and payment collections.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: `AED ${(totalRevenue/1000).toFixed(0)}K`, color: "text-blue-600" },
          { label: "Collected", value: `AED ${(totalPaid/1000).toFixed(0)}K`, color: "text-green-600" },
          { label: "Outstanding", value: `AED ${(totalOutstanding/1000).toFixed(0)}K`, color: "text-red-600" },
          { label: "Collection Rate", value: `${collectionRate}%`, color: "text-amber-600" },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-xl p-5">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary" />Payment Status</h2>
          {[
            { label: "Paid", count: paidCount, value: invoices?.filter(i => i.paymentStatus === "paid").reduce((s,i) => s+(i.grandTotal??0), 0) ?? 0, color: "bg-green-500" },
            { label: "Partial", count: partialCount, value: invoices?.filter(i => i.paymentStatus === "partial").reduce((s,i) => s+(i.grandTotal??0), 0) ?? 0, color: "bg-amber-500" },
            { label: "Unpaid", count: unpaidCount, value: invoices?.filter(i => i.paymentStatus === "unpaid").reduce((s,i) => s+(i.grandTotal??0), 0) ?? 0, color: "bg-red-500" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-16 text-sm text-muted-foreground">{s.label}</div>
              <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                <div className={`h-full ${s.color} opacity-75 rounded-md`} style={{ width: `${totalRevenue > 0 ? (s.value / totalRevenue * 100) : 0}%` }} />
              </div>
              <div className="text-sm font-medium w-10 text-right">{s.count}</div>
              <div className="text-xs text-muted-foreground w-20 text-right">AED {(s.value/1000).toFixed(0)}K</div>
            </div>
          ))}
        </div>

        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">Monthly Revenue</h2>
          {sortedMonths.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data available.</p>
          ) : sortedMonths.map(([month, value]) => (
            <div key={month} className="flex items-center gap-3">
              <div className="w-16 text-xs text-muted-foreground shrink-0">{month}</div>
              <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                <div className="h-full bg-primary/60 rounded" style={{ width: `${(value / maxMonthly) * 100}%` }} />
              </div>
              <div className="text-xs font-medium w-20 text-right text-muted-foreground">AED {(value/1000).toFixed(0)}K</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Invoice Ledger</h2>
          <div className="text-sm text-muted-foreground text-right">
            Outstanding: <span className="text-red-600 font-semibold">AED {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-3 font-medium">Invoice #</th>
              <th className="text-left p-3 font-medium">Client</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-right p-3 font-medium">Total (AED)</th>
              <th className="text-right p-3 font-medium">Paid (AED)</th>
              <th className="text-right p-3 font-medium">Balance (AED)</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices?.slice(0, 20).map(inv => (
              <tr key={inv.id} className="border-t hover:bg-muted/20">
                <td className="p-3 font-mono font-medium">{inv.invoiceNumber}</td>
                <td className="p-3">{inv.clientName}</td>
                <td className="p-3 text-muted-foreground">{inv.invoiceDate || "-"}</td>
                <td className="p-3 text-right font-medium">AED {(inv.grandTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-3 text-right text-green-600">AED {(inv.amountPaid ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-3 text-right text-red-600 font-medium">AED {(inv.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-3"><Badge variant="secondary" className={statusColors[inv.paymentStatus] ?? ""}>{inv.paymentStatus}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
