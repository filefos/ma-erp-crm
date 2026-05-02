import { useState } from "react";
import { useListExpenses, useListCompanies } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExportMenu } from "@/components/ExportMenu";
import { Receipt, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

export function VatReport() {
  const today = new Date().toISOString().split("T")[0];
  const firstOfYear = `${new Date().getFullYear()}-01-01`;

  const [fromDate, setFromDate] = useState(firstOfYear);
  const [toDate, setToDate] = useState(today);
  const [companyFilter, setCompanyFilter] = useState("all");

  const { data: expenses = [] } = useListExpenses();
  const { data: companies = [] } = useListCompanies();
  const { filterByCompany } = useActiveCompany();

  const allExpenses = filterByCompany(expenses);

  const inRange = (dateStr: string | null | undefined) => {
    if (!dateStr) return true;
    return dateStr >= fromDate && dateStr <= toDate;
  };

  const filteredExpenses = allExpenses.filter(e => {
    const matchCompany = companyFilter === "all" || String(e.companyId) === companyFilter;
    return matchCompany && inRange(e.paymentDate ?? e.createdAt?.toString().split("T")[0]);
  });

  const inputVat = filteredExpenses.reduce((s, e) => s + (e.vatAmount ?? 0), 0);
  const outputVatRate = 0.05;
  const outputVatBase = filteredExpenses.reduce((s, e) => s + (e.amount ?? 0), 0);
  const outputVat = outputVatBase * outputVatRate;
  const netVat = outputVat - inputVat;

  const vatRows = filteredExpenses.map(e => ({
    date: e.paymentDate ?? String(e.createdAt).split("T")[0],
    description: e.description || e.category,
    category: e.category,
    amount: e.amount ?? 0,
    vatAmount: e.vatAmount ?? 0,
    total: e.total ?? 0,
    companyId: e.companyId,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">VAT Report</h1>
          <p className="text-muted-foreground">UAE VAT 5% — Input and Output Tax Summary</p>
        </div>
        <ExportMenu
          data={vatRows as Record<string, unknown>[]}
          columns={[
            { header: "Date", key: "date" },
            { header: "Description", key: "description" },
            { header: "Category", key: "category" },
            { header: "Amount (AED)", key: "amount", format: v => Number(v ?? 0).toFixed(2) },
            { header: "VAT (AED)", key: "vatAmount", format: v => Number(v ?? 0).toFixed(2) },
            { header: "Total (AED)", key: "total", format: v => Number(v ?? 0).toFixed(2) },
          ]}
          filename="vat-report"
          title="VAT Report"
          size="sm"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/30 border rounded-xl">
        <div className="space-y-1">
          <Label className="text-xs">From Date</Label>
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To Date</Label>
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Company</Label>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.shortName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => { setFromDate(firstOfYear); setToDate(today); setCompanyFilter("all"); }}
        >
          Reset
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="flex flex-row items-center gap-3 pb-2 pt-4 px-4">
            <div className="p-2 bg-green-100 rounded-lg"><TrendingUp className="w-4 h-4 text-green-700" /></div>
            <CardTitle className="text-sm font-medium text-green-700">Output VAT (5%)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold text-green-800">AED {outputVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div className="text-xs text-green-600 mt-0.5">On sales & revenue</div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="flex flex-row items-center gap-3 pb-2 pt-4 px-4">
            <div className="p-2 bg-red-100 rounded-lg"><TrendingDown className="w-4 h-4 text-red-700" /></div>
            <CardTitle className="text-sm font-medium text-red-700">Input VAT (Paid)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold text-red-800">AED {inputVat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div className="text-xs text-red-600 mt-0.5">On purchases & expenses</div>
          </CardContent>
        </Card>

        <Card className={netVat >= 0 ? "border-orange-200 bg-orange-50" : "border-blue-200 bg-blue-50"}>
          <CardHeader className="flex flex-row items-center gap-3 pb-2 pt-4 px-4">
            <div className={`p-2 rounded-lg ${netVat >= 0 ? "bg-orange-100" : "bg-blue-100"}`}>
              <DollarSign className={`w-4 h-4 ${netVat >= 0 ? "text-orange-700" : "text-blue-700"}`} />
            </div>
            <CardTitle className={`text-sm font-medium ${netVat >= 0 ? "text-orange-700" : "text-blue-700"}`}>
              {netVat >= 0 ? "VAT Payable" : "VAT Refundable"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className={`text-xl font-bold ${netVat >= 0 ? "text-orange-800" : "text-blue-800"}`}>
              AED {Math.abs(netVat).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className={`text-xs mt-0.5 ${netVat >= 0 ? "text-orange-600" : "text-blue-600"}`}>Net VAT position</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2 pt-4 px-4">
            <div className="p-2 bg-primary/10 rounded-lg"><Receipt className="w-4 h-4 text-primary" /></div>
            <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{vatRows.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">In selected period</div>
          </CardContent>
        </Card>
      </div>

      {/* VAT Summary Box */}
      <div className="bg-[#0f2d5a]/5 border border-[#0f2d5a]/20 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#0f2d5a] mb-3 uppercase tracking-wide">UAE VAT Return Summary</h3>
        <div className="space-y-2 text-sm">
          {[
            { label: "Standard Rated Supplies (Output Base)", value: outputVatBase, color: "text-gray-700" },
            { label: "Output VAT @ 5%", value: outputVat, color: "text-green-700" },
            { label: "Input VAT Recoverable", value: inputVat, color: "text-red-700" },
            { label: "Net VAT Due / (Refundable)", value: netVat, color: netVat >= 0 ? "text-orange-700 font-bold" : "text-blue-700 font-bold" },
          ].map(row => (
            <div key={row.label} className="flex justify-between py-1.5 border-b border-[#0f2d5a]/10">
              <span className="text-muted-foreground">{row.label}</span>
              <span className={`font-mono ${row.color}`}>AED {row.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">VAT Rate: 5% | Currency: AED | Reporting period: {fromDate} to {toDate}</div>
      </div>

      {/* Expense detail table */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Input VAT Detail (Expenses)</h3>
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount (AED)</TableHead>
                <TableHead className="text-right">VAT (AED)</TableHead>
                <TableHead className="text-right">Total (AED)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vatRows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No data for selected period.</TableCell></TableRow>
              ) : vatRows.map((r, i) => (
                <TableRow key={i} className="hover:bg-muted/40">
                  <TableCell className="text-sm">{r.date}</TableCell>
                  <TableCell className="text-sm">{r.description || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize text-xs">{r.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-red-700">{r.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">{r.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
