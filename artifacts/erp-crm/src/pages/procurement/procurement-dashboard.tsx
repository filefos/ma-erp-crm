import { useGetProcurementDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, Send, BarChart3, ShoppingCart, CheckCircle, Clock, DollarSign } from "lucide-react";
import { Link } from "wouter";

export default function ProcurementDashboardPage() {
  const { data, isLoading } = useGetProcurementDashboard();

  const stats = [
    {
      label: "Total Suppliers",
      value: data?.totalSuppliers ?? 0,
      sub: `${data?.activeSuppliers ?? 0} active`,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      label: "PRs Pending Approval",
      value: data?.prPending ?? 0,
      sub: `${data?.prApproved ?? 0} approved`,
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950",
    },
    {
      label: "RFQs Sent",
      value: data?.rfqSent ?? 0,
      sub: `${data?.sqReceived ?? 0} quotations received`,
      icon: Send,
      color: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-950",
    },
    {
      label: "POs Issued",
      value: data?.poIssued ?? 0,
      sub: `${data?.poPending ?? 0} pending approval`,
      icon: CheckCircle,
      color: "text-green-500",
      bg: "bg-green-50 dark:bg-green-950",
    },
    {
      label: "Total PO Value",
      value: `AED ${(data?.totalPoValue ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}`,
      sub: "All time",
      icon: DollarSign,
      color: "text-[#1e6ab0]",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
  ];

  const steps = [
    { step: 1, label: "Purchase Request", icon: FileText, desc: "Departments request materials/services", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
    { step: 2, label: "RFQ", icon: Send, desc: "Request for quotation sent to suppliers", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
    { step: 3, label: "Supplier Quotation", icon: BarChart3, desc: "Collect & compare supplier quotes", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
    { step: 4, label: "Purchase Order", icon: ShoppingCart, desc: "Issue PO to selected supplier", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0f2d5a] dark:text-white">Procurement Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of procurement activities and KPIs</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 text-[#0f2d5a] dark:text-white">{isLoading ? "—" : stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                </div>
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Procurement Flow */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[#0f2d5a] dark:text-white">Procurement Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            {steps.map((s, i) => (
              <div key={s.step} className="flex-1 relative">
                <div className={`rounded-xl p-4 ${s.color}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold opacity-60">STEP {s.step}</span>
                  </div>
                  <s.icon className="w-6 h-6 mb-2" />
                  <p className="font-semibold text-sm">{s.label}</p>
                  <p className="text-xs opacity-75 mt-1">{s.desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden sm:flex absolute top-1/2 -right-2 transform -translate-y-1/2 z-10">
                    <span className="text-muted-foreground text-lg font-bold">›</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[#0f2d5a] dark:text-white">Quick Navigation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Suppliers", href: "/procurement/suppliers", icon: Users, badge: data?.totalSuppliers },
              { label: "Purchase Requests", href: "/procurement/purchase-requests", icon: FileText, badge: data?.prPending, badgeColor: "bg-amber-100 text-amber-700" },
              { label: "RFQs", href: "/procurement/rfqs", icon: Send, badge: data?.rfqSent },
              { label: "Purchase Orders", href: "/procurement/purchase-orders", icon: ShoppingCart, badge: data?.poIssued },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border hover:border-[#1e6ab0] hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors cursor-pointer"
              >
                <link.icon className="w-8 h-8 text-[#1e6ab0]" />
                <span className="text-sm font-medium text-center">{link.label}</span>
                {link.badge != null && link.badge > 0 && (
                  <Badge className={link.badgeColor ?? "bg-blue-100 text-blue-700"}>{link.badge}</Badge>
                )}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
