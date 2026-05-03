import { useMemo, useState } from "react";
import { useListPayroll } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, Calendar, Users, AlertTriangle, Download } from "lucide-react";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtAED(n: number): string {
  return `AED ${n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  if (!y || !m) return yyyymm;
  return new Date(y, m - 1, 1).toLocaleDateString("en-AE", { month: "long", year: "numeric" });
}

export function PayrollPage() {
  const { activeCompanyId } = useActiveCompany();
  const [month, setMonth] = useState<string>(currentMonth());

  const { data, isLoading } = useListPayroll({ month, companyId: activeCompanyId });
  const rows = useMemo(() => data?.rows ?? [], [data]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        gross: acc.gross + r.grossPay,
        deductions: acc.deductions + r.unauthorisedDeduction,
        net: acc.net + r.netPay,
        unauthorised: acc.unauthorised + r.unauthorisedDays,
      }),
      { gross: 0, deductions: 0, net: 0, unauthorised: 0 },
    );
  }, [rows]);

  function exportCsv() {
    const headers = [
      "Employee ID", "Name", "Designation", "Company", "Basic", "Allowances",
      "Monthly Salary", "Daily Wage", "Days in Month", "Present Days",
      "Absent Days", "Unauthorised Days", "Gross Pay", "Deduction", "Net Pay",
    ];
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push([
        r.employeeCode, JSON.stringify(r.employeeName), JSON.stringify(r.designation ?? ""),
        JSON.stringify(r.companyName ?? ""), r.basicSalary, r.allowances, r.monthlySalary,
        r.dailyWage, r.daysInMonth, r.presentDays, r.absentDays, r.unauthorisedDays,
        r.grossPay, r.unauthorisedDeduction, r.netPay,
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-payroll">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[#0f2d5a]">
            <Wallet className="h-6 w-6" /> Payroll
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monthly pay computed automatically from attendance. Daily wage = monthly salary &divide; 30.
            Unauthorised absences trigger a 3&nbsp;days&apos; salary deduction each, per the offer letter rule.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
            className="w-44"
            data-testid="input-payroll-month"
          />
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length} data-testid="button-payroll-export">
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-payroll-employees">{rows.length}</div>
            <div className="text-xs text-muted-foreground mt-1">{monthLabel(data?.month ?? month)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Gross Pay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1e6ab0]" data-testid="kpi-payroll-gross">{fmtAED(totals.gross)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Deductions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700" data-testid="kpi-payroll-deductions">{fmtAED(totals.deductions)}</div>
            <div className="text-xs text-muted-foreground mt-1">{totals.unauthorised} unauthorised day(s)</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Net Payable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700" data-testid="kpi-payroll-net">{fmtAED(totals.net)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Detail &mdash; {monthLabel(data?.month ?? month)}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !rows.length ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              No active employees in scope for this month.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Employee</th>
                    <th className="text-left py-2 px-2">Company</th>
                    <th className="text-right py-2 px-2">Salary</th>
                    <th className="text-right py-2 px-2">Daily</th>
                    <th className="text-right py-2 px-2">Present</th>
                    <th className="text-right py-2 px-2">Absent</th>
                    <th className="text-right py-2 px-2">Unauth.</th>
                    <th className="text-right py-2 px-2">Gross</th>
                    <th className="text-right py-2 px-2">Deduction</th>
                    <th className="text-right py-2 px-2">Net Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.employeeId} className="border-b hover:bg-slate-50" data-testid={`row-payroll-${r.employeeId}`}>
                      <td className="py-2 px-2">
                        <div className="font-medium">{r.employeeName}</div>
                        <div className="text-xs text-muted-foreground">{r.employeeCode}{r.designation ? ` · ${r.designation}` : ""}</div>
                      </td>
                      <td className="py-2 px-2 text-xs">{r.companyName ?? "—"}</td>
                      <td className="py-2 px-2 text-right">{fmtAED(r.monthlySalary)}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{fmtAED(r.dailyWage)}</td>
                      <td className="py-2 px-2 text-right">
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">{r.presentDays}</Badge>
                      </td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{r.absentDays}</td>
                      <td className="py-2 px-2 text-right">
                        {r.unauthorisedDays > 0
                          ? <Badge variant="destructive">{r.unauthorisedDays}</Badge>
                          : <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="py-2 px-2 text-right">{fmtAED(r.grossPay)}</td>
                      <td className="py-2 px-2 text-right text-amber-700">
                        {r.unauthorisedDeduction > 0 ? `− ${fmtAED(r.unauthorisedDeduction)}` : "—"}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold text-emerald-700">{fmtAED(r.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold bg-slate-50">
                    <td className="py-2 px-2" colSpan={7}>Totals</td>
                    <td className="py-2 px-2 text-right">{fmtAED(totals.gross)}</td>
                    <td className="py-2 px-2 text-right text-amber-700">− {fmtAED(totals.deductions)}</td>
                    <td className="py-2 px-2 text-right text-emerald-700">{fmtAED(totals.net)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
