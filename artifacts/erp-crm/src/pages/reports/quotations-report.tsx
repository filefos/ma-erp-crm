import { useListQuotations } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-amber-100 text-amber-800",
};

export function QuotationsReport() {
  const { data: quotations, isLoading } = useListQuotations();

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading report...</div>;

  const total = quotations?.length ?? 0;
  const totalValue = quotations?.reduce((s, q) => s + (q.grandTotal ?? 0), 0) ?? 0;
  const approvedValue = quotations?.filter(q => q.status === "approved").reduce((s, q) => s + (q.grandTotal ?? 0), 0) ?? 0;
  const approvedCount = quotations?.filter(q => q.status === "approved").length ?? 0;

  const statusBreakdown = ["draft","sent","approved","rejected","expired"].map(status => {
    const items = quotations?.filter(q => q.status === status) ?? [];
    const val = items.reduce((s, q) => s + (q.grandTotal ?? 0), 0);
    return { status, count: items.length, value: val };
  });

  const byCompany: Record<string, { count: number; value: number }> = {};
  quotations?.forEach(q => {
    const key = (q as any).companyRef ?? "Unknown";
    if (!byCompany[key]) byCompany[key] = { count: 0, value: 0 };
    byCompany[key].count += 1;
    byCompany[key].value += q.grandTotal ?? 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link href="/reports"><ArrowLeft className="w-4 h-4 mr-1" />Reports</Link></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotation Report</h1>
          <p className="text-muted-foreground text-sm">All quotations by status, value, and company.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Quotations", value: total, color: "text-foreground" },
          { label: "Total Value (AED)", value: `${(totalValue/1000).toFixed(0)}K`, color: "text-blue-600" },
          { label: "Approved", value: approvedCount, color: "text-green-600" },
          { label: "Won Value (AED)", value: `${(approvedValue/1000).toFixed(0)}K`, color: "text-green-600" },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-xl p-5">
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Status Breakdown</h2>
          {statusBreakdown.map(s => (
            <div key={s.status} className="flex items-center justify-between py-2 border-b last:border-0">
              <Badge variant="secondary" className={statusColors[s.status] ?? ""}>{s.status}</Badge>
              <div className="text-right">
                <div className="font-semibold">{s.count} quotations</div>
                <div className="text-xs text-muted-foreground">AED {s.value.toLocaleString(undefined, { minimumFractionDigits: 0 })}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">By Company</h2>
          {Object.entries(byCompany).map(([company, data]) => (
            <div key={company} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="font-medium text-sm">{company}</span>
              <div className="text-right">
                <div className="font-semibold">{data.count}</div>
                <div className="text-xs text-muted-foreground">AED {data.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
            </div>
          ))}
          {Object.keys(byCompany).length === 0 && <p className="text-sm text-muted-foreground">No data.</p>}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">All Quotations</h2>
          <span className="text-sm text-muted-foreground">{total} records</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-3 font-medium">Quotation #</th>
              <th className="text-left p-3 font-medium">Client</th>
              <th className="text-left p-3 font-medium">Project</th>
              <th className="text-right p-3 font-medium">Value (AED)</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {quotations?.slice(0, 20).map(q => (
              <tr key={q.id} className="border-t hover:bg-muted/20">
                <td className="p-3">
                  <Link href={`/sales/quotations/${q.id}`} className="text-primary hover:underline font-mono font-medium">{q.quotationNumber}</Link>
                </td>
                <td className="p-3">{q.clientName}</td>
                <td className="p-3 text-muted-foreground">{q.projectName || "-"}</td>
                <td className="p-3 text-right font-medium">AED {(q.grandTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-3"><Badge variant="secondary" className={statusColors[q.status] ?? ""}>{q.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
