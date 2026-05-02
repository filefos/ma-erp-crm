import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { FileText, Users, Package, TrendingUp, CreditCard, Briefcase, BarChart2, PieChart } from "lucide-react";

const REPORTS = [
  { title: "Sales Pipeline Report", description: "Lead stages, conversion rates, and deal values by salesperson and company.", icon: TrendingUp, href: "/reports/sales-pipeline", color: "bg-blue-50 dark:bg-blue-900/20 text-blue-600" },
  { title: "Quotation Report", description: "All quotations by status, value, company, and client.", icon: FileText, href: "/reports/quotations", color: "bg-purple-50 dark:bg-purple-900/20 text-purple-600" },
  { title: "Revenue & Invoice Report", description: "Invoice totals, outstanding receivables, payment collections.", icon: BarChart2, href: "/reports/revenue", color: "bg-green-50 dark:bg-green-900/20 text-green-600" },
  { title: "Expense Report", description: "Expenses by category, company, and time period.", icon: CreditCard, href: "/reports/expenses", color: "bg-red-50 dark:bg-red-900/20 text-red-600" },
  { title: "Inventory Stock Report", description: "Current stock levels, low stock items, stock movement history.", icon: Package, href: "/reports/inventory", color: "bg-orange-50 dark:bg-orange-900/20 text-orange-600" },
  { title: "Project Status Report", description: "Project pipeline, stages, payment and delivery tracking.", icon: Briefcase, href: "/reports/projects", color: "bg-teal-50 dark:bg-teal-900/20 text-teal-600" },
  { title: "Attendance Report", description: "Monthly attendance summary, overtime, and absence tracking.", icon: Users, href: "/reports/attendance", color: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600" },
  { title: "Purchase & Procurement Report", description: "Purchase orders, supplier spending, and procurement analysis.", icon: PieChart, href: "/reports/procurement", color: "bg-orange-50 dark:bg-orange-900/20 text-orange-600" },
];

export function ReportsHub() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">All Reports</h1>
        <p className="text-muted-foreground">Browse every detailed module report — for the executive overview see <Link href="/reports/dashboard" className="text-primary underline">Reports Dashboard</Link>.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {REPORTS.map(report => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href}>
              <Card className="h-full cursor-pointer hover:shadow-md transition-shadow hover:border-primary/30">
                <CardHeader className="pb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${report.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base">{report.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{report.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
