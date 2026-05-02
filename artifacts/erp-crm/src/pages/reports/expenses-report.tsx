import { useListExpenses, useListCompanies } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, CreditCard } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusColors: Record<string, string> = {
  pending: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const CATEGORY_COLORS = ["bg-blue-500","bg-purple-500","bg-green-500","bg-orange-500","bg-red-500","bg-teal-500","bg-indigo-500","bg-pink-500","bg-orange-500","bg-gray-500"];

export function ExpensesReport() {
  const [companyFilter, setCompanyFilter] = useState("all");
  const { data: expenses, isLoading } = useListExpenses();
  const { data: companies } = useListCompanies();

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading report...</div>;

  const filtered = expenses?.filter(e => companyFilter === "all" || String(e.companyId) === companyFilter) ?? [];

  const total = filtered.reduce((s, e) => s + (e.total ?? 0), 0);
  const pendingAmt = filtered.filter(e => e.status === "pending").reduce((s, e) => s + (e.total ?? 0), 0);
  const approvedAmt = filtered.filter(e => e.status === "approved").reduce((s, e) => s + (e.total ?? 0), 0);

  const byCategory: Record<string, number> = {};
  filtered.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + (e.total ?? 0);
  });
  const sortedCategories = Object.entries(byCategory).sort(([, a], [, b]) => b - a);
  const maxCat = Math.max(...sortedCategories.map(([, v]) => v), 1);

  const byMethod: Record<string, number> = {};
  filtered.forEach(e => {
    const m = e.paymentMethod ?? "unknown";
    byMethod[m] = (byMethod[m] ?? 0) + (e.total ?? 0);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link href="/reports"><ArrowLeft className="w-4 h-4 mr-1" />Reports</Link></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expense Report</h1>
          <p className="text-muted-foreground text-sm">Expenses by category, company, and time period.</p>
        </div>
        <div className="ml-auto">
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.shortName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Expenses", value: `AED ${(total/1000).toFixed(1)}K`, color: "text-foreground" },
          { label: "Approved", value: `AED ${(approvedAmt/1000).toFixed(1)}K`, color: "text-green-600" },
          { label: "Pending Approval", value: `AED ${(pendingAmt/1000).toFixed(1)}K`, color: "text-orange-600" },
          { label: "Expense Records", value: filtered.length, color: "text-blue-600" },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-xl p-5">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" />By Category</h2>
          {sortedCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data.</p>
          ) : sortedCategories.map(([cat, val], i) => (
            <div key={cat} className="flex items-center gap-3">
              <div className="capitalize text-sm w-24 shrink-0 text-muted-foreground">{cat}</div>
              <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                <div className={`h-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} opacity-70 rounded-md`} style={{ width: `${(val / maxCat) * 100}%` }} />
              </div>
              <div className="text-xs font-medium text-right w-20">AED {(val/1000).toFixed(1)}K</div>
            </div>
          ))}
        </div>

        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">Payment Methods</h2>
          {Object.entries(byMethod).sort(([,a],[,b]) => b - a).map(([method, val]) => (
            <div key={method} className="flex items-center justify-between py-1.5 border-b last:border-0">
              <span className="capitalize text-sm">{method.replace("_"," ")}</span>
              <span className="font-semibold text-sm">AED {val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
          {Object.keys(byMethod).length === 0 && <p className="text-sm text-muted-foreground">No data.</p>}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b"><h2 className="font-semibold">Expense Details</h2></div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-3 font-medium">Expense #</th>
              <th className="text-left p-3 font-medium">Category</th>
              <th className="text-left p-3 font-medium">Description</th>
              <th className="text-right p-3 font-medium">Amount (AED)</th>
              <th className="text-left p-3 font-medium">Method</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 20).map(e => (
              <tr key={e.id} className="border-t hover:bg-muted/20">
                <td className="p-3 font-mono text-xs text-primary">{e.expenseNumber}</td>
                <td className="p-3 capitalize">{e.category}</td>
                <td className="p-3 text-muted-foreground max-w-[200px] truncate">{e.description || "-"}</td>
                <td className="p-3 text-right font-medium">AED {(e.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-3 capitalize text-muted-foreground">{e.paymentMethod?.replace("_"," ")}</td>
                <td className="p-3"><Badge variant="secondary" className={statusColors[e.status] ?? ""}>{e.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
