import { useMemo } from "react";
import { Link } from "wouter";
import {
  useGetProcurementDashboard, useListSuppliers, useListPurchaseRequests,
  useListPurchaseOrders, useListRfqs, useListSupplierQuotations,
} from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart as RPieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import {
  Building2, ShoppingCart, FileText, Send, ClipboardList, CheckCircle2, Clock,
  TrendingUp, ArrowRight, Sparkles, DollarSign, AlertTriangle, Truck, Package, Crown,
} from "lucide-react";
import {
  ExecutiveHeader, KPIWidget, weeklyValues, trendPct, Avatar,
} from "@/components/crm/premium";

const PALETTE = ["#1e6ab0", "#0f2d5a", "#10b981", "#f97316", "#8b5cf6", "#06b6d4", "#ef4444", "#14b8a6"];

function fmtAED(v: number): string {
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `AED ${(v / 1_000).toFixed(0)}k`;
  return `AED ${Math.round(v).toLocaleString()}`;
}

export default function ProcurementDashboardPage() {
  const { filterByCompany } = useActiveCompany();
  const { data: summary }      = useGetProcurementDashboard();
  const { data: suppliersRaw } = useListSuppliers({});
  const { data: prsRaw }       = useListPurchaseRequests({});
  const { data: posRaw }       = useListPurchaseOrders();
  const { data: rfqsRaw }      = useListRfqs({});
  const { data: sqsRaw }       = useListSupplierQuotations({});

  const suppliers = useMemo(() => filterByCompany(suppliersRaw ?? []), [suppliersRaw, filterByCompany]);
  const prs       = useMemo(() => filterByCompany(prsRaw       ?? []), [prsRaw,       filterByCompany]);
  const pos       = useMemo(() => filterByCompany(posRaw       ?? []), [posRaw,       filterByCompany]);
  const rfqs      = useMemo(() => filterByCompany(rfqsRaw      ?? []), [rfqsRaw,      filterByCompany]);
  const sqs       = useMemo(() => filterByCompany(sqsRaw       ?? []), [sqsRaw,       filterByCompany]);

  // KPIs from summary as fallback + computed live
  const totalSuppliers = suppliers.length || (summary?.totalSuppliers ?? 0);
  const activeSuppliers = suppliers.filter((s: any) => s.isActive !== false).length || (summary?.activeSuppliers ?? 0);
  const prPending = prs.filter((p: any) => (p.status ?? "").toLowerCase() === "pending_approval").length || (summary?.prPending ?? 0);
  const prApproved = prs.filter((p: any) => (p.status ?? "").toLowerCase() === "approved").length || (summary?.prApproved ?? 0);
  const rfqSent = rfqs.filter((r: any) => (r.status ?? "").toLowerCase() === "sent").length || (summary?.rfqSent ?? 0);
  const sqReceived = sqs.length || (summary?.sqReceived ?? 0);
  const poIssued = pos.filter((p: any) => !["draft", "pending_approval"].includes((p.status ?? "").toLowerCase())).length || (summary?.poIssued ?? 0);
  const poPending = pos.filter((p: any) => (p.status ?? "").toLowerCase() === "pending_approval").length || (summary?.poPending ?? 0);
  const totalPoValue = pos.reduce((s: number, p: any) => s + Number(p.grandTotal ?? p.totalAmount ?? 0), 0) || Number(summary?.totalPoValue ?? 0);
  const avgPoValue = pos.length > 0 ? totalPoValue / pos.length : 0;

  // Sparklines
  const prSpark    = useMemo(() => weeklyValues(prs,  "createdAt", () => 1, 8), [prs]);
  const rfqSpark   = useMemo(() => weeklyValues(rfqs, "createdAt", () => 1, 8), [rfqs]);
  const poSpark    = useMemo(() => weeklyValues(pos,  "createdAt", (p: any) => Number(p.grandTotal ?? p.totalAmount ?? 0), 8), [pos]);
  const supplierSpark = useMemo(() => weeklyValues(suppliers, "createdAt", () => 1, 8), [suppliers]);

  // Funnel: PR → RFQ → SQ → PO
  const funnelData = useMemo(() => ([
    { stage: "Purchase Requests",    count: prs.length,  pending: prs.filter((p: any) => (p.status ?? "").toLowerCase() === "pending_approval").length },
    { stage: "RFQs Issued",          count: rfqs.length, pending: rfqs.filter((r: any) => (r.status ?? "").toLowerCase() === "sent").length },
    { stage: "Supplier Quotations",  count: sqs.length,  pending: sqs.filter((s: any) => (s.status ?? "").toLowerCase() === "pending").length },
    { stage: "Purchase Orders",      count: pos.length,  pending: poPending },
  ]), [prs, rfqs, sqs, pos, poPending]);

  // PO Status mix
  const poStatusMix = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of pos as any[]) {
      const k = (p.status ?? "draft").toLowerCase();
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  }, [pos]);

  // Top suppliers by PO spend
  const topSuppliers = useMemo(() => {
    const m: Record<string, { id: number; name: string; count: number; value: number }> = {};
    for (const p of pos as any[]) {
      const sup = suppliers.find((s: any) => s.id === p.supplierId);
      const key = sup?.name ?? p.supplierName ?? `Supplier #${p.supplierId ?? "?"}`;
      const e = m[key] ?? { id: p.supplierId, name: key, count: 0, value: 0 };
      e.count++;
      e.value += Number(p.grandTotal ?? p.totalAmount ?? 0);
      m[key] = e;
    }
    return Object.values(m).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [pos, suppliers]);

  // Monthly PO trend (12 months)
  const now = new Date();
  const monthlyPo = useMemo(() => {
    const arr: { month: string; pos: number; value: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const inRange = (raw?: string) => {
        if (!raw) return false;
        const t = new Date(raw).getTime();
        return t >= start.getTime() && t < end.getTime();
      };
      const monthly = pos.filter((p: any) => inRange(p.createdAt));
      arr.push({
        month: start.toLocaleDateString("en-AE", { month: "short" }),
        pos:   monthly.length,
        value: monthly.reduce((s: number, p: any) => s + Number(p.grandTotal ?? p.totalAmount ?? 0), 0),
      });
    }
    return arr;
  }, [pos, now]);

  // Pending approvals lists
  const pendingPrs = useMemo(() => prs.filter((p: any) => (p.status ?? "").toLowerCase() === "pending_approval").slice(0, 5), [prs]);
  const pendingPos = useMemo(() => pos.filter((p: any) => (p.status ?? "").toLowerCase() === "pending_approval").slice(0, 5), [pos]);

  // Insights
  const insights = useMemo(() => {
    const out: { tone: "red" | "amber" | "blue"; text: string }[] = [];
    if (prPending >= 5) out.push({ tone: "red", text: `${prPending} purchase requests waiting for approval` });
    else if (prPending > 0) out.push({ tone: "amber", text: `${prPending} purchase request${prPending === 1 ? "" : "s"} pending approval` });
    if (poPending > 0) out.push({ tone: "amber", text: `${poPending} PO${poPending === 1 ? "" : "s"} pending approval` });
    const stuckRfqs = rfqs.filter((r: any) => (r.status ?? "").toLowerCase() === "sent" && r.createdAt && (Date.now() - new Date(r.createdAt).getTime()) > 7 * 86_400_000).length;
    if (stuckRfqs > 0) out.push({ tone: "amber", text: `${stuckRfqs} RFQ${stuckRfqs === 1 ? "" : "s"} awaiting supplier quotes (7+ days)` });
    if (out.length === 0 && totalSuppliers > 0) out.push({ tone: "blue", text: "Procurement pipeline running smoothly." });
    return out.slice(0, 4);
  }, [prPending, poPending, rfqs, totalSuppliers]);

  return (
    <div className="space-y-5">
      <ExecutiveHeader
        icon={ShoppingCart}
        title="Procurement Command Center"
        subtitle="Suppliers · PRs · RFQs · Quotations · POs · Spend"
      >
        <Button size="sm" variant="secondary" asChild className="bg-white/15 hover:bg-white/25 text-white border-0">
          <Link href="/procurement/purchase-requests"><ClipboardList className="w-4 h-4 mr-1.5" />PRs</Link>
        </Button>
        <Button size="sm" variant="secondary" asChild className="bg-white/15 hover:bg-white/25 text-white border-0">
          <Link href="/procurement/rfqs"><Send className="w-4 h-4 mr-1.5" />RFQs</Link>
        </Button>
        <Button size="sm" asChild className="bg-white text-[#0f2d5a] hover:bg-white/90">
          <Link href="/procurement/purchase-orders"><ShoppingCart className="w-4 h-4 mr-1.5" />Purchase Orders</Link>
        </Button>
      </ExecutiveHeader>

      {insights.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#0f2d5a] to-[#1e6ab0]" />
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] flex items-center justify-center shadow">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-semibold">Procurement Insights</h3>
            <Badge variant="secondary" className="text-[10px] bg-[#1e6ab0]/10 text-[#1e6ab0] border-0">live</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {insights.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm rounded-lg p-2 bg-muted/40">
                <div className={`w-2 h-2 rounded-full shrink-0 ${r.tone === "red" ? "bg-red-500" : r.tone === "amber" ? "bg-orange-500" : "bg-emerald-500"}`} />
                <span className="text-foreground/85">{r.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIWidget icon={Building2}    tone="navy"    label="Suppliers"        value={totalSuppliers}      sub={`${activeSuppliers} active`}            sparkline={supplierSpark} trend={trendPct(supplierSpark)} href="/procurement/suppliers" testId="kpi-suppliers" />
        <KPIWidget icon={ClipboardList} tone={prPending > 0 ? "amber" : "blue"} label="Purchase Requests" value={prs.length} sub={`${prPending} pending · ${prApproved} approved`} sparkline={prSpark} trend={trendPct(prSpark)} href="/procurement/purchase-requests" testId="kpi-prs" />
        <KPIWidget icon={Send}         tone="purple"  label="RFQs"             value={rfqs.length}         sub={`${rfqSent} sent · ${sqReceived} quotes received`} sparkline={rfqSpark} trend={trendPct(rfqSpark)} href="/procurement/rfqs" testId="kpi-rfqs" />
        <KPIWidget icon={ShoppingCart} tone="green"   label="Purchase Orders"  value={pos.length}          sub={`${poIssued} issued · ${poPending} pending`} href="/procurement/purchase-orders" testId="kpi-pos" />
        <KPIWidget icon={DollarSign}   tone="blue"    label="Total PO Spend"   value={fmtAED(totalPoValue)} sub={`Avg ${fmtAED(avgPoValue)}`}            sparkline={poSpark} trend={trendPct(poSpark)} href="/procurement/purchase-orders" testId="kpi-po-spend" />
        <KPIWidget icon={FileText}     tone="indigo"  label="Supplier Quotes"  value={sqs.length}          sub={`${sqs.filter((s: any) => (s.status ?? "").toLowerCase() === "pending").length} pending review`} href="/procurement/supplier-quotations" testId="kpi-sqs" />
        <KPIWidget icon={CheckCircle2} tone="teal"    label="PR Approval Rate" value={`${prs.length > 0 ? Math.round((prApproved / prs.length) * 100) : 0}%`} sub="Approved / total"      href="/procurement/purchase-requests" testId="kpi-approval" />
        <KPIWidget icon={AlertTriangle} tone={poPending > 0 ? "red" : "slate"} label="Pending Approvals" value={prPending + poPending} sub="PRs + POs awaiting" testId="kpi-pending" />
      </div>

      {/* Funnel + status pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PanelCard title="Procurement Funnel" subtitle="PR → RFQ → Supplier Quote → PO" icon={TrendingUp} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 40, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} width={140} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="count"   name="Total"   fill="#1e6ab0" radius={[0, 6, 6, 0]} />
              <Bar dataKey="pending" name="Pending" fill="#f97316" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </PanelCard>

        <PanelCard title="PO Status Mix" subtitle="Across all purchase orders" icon={Package}>
          {poStatusMix.length === 0 ? (
            <Empty>No POs yet.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <RPieChart>
                <Pie data={poStatusMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                  {poStatusMix.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RPieChart>
            </ResponsiveContainer>
          )}
        </PanelCard>
      </div>

      {/* Monthly PO trend */}
      <PanelCard title="12-Month PO Trend" subtitle="Procurement spend over time" icon={Truck}>
        {monthlyPo.every(m => m.pos === 0) ? (
          <Empty>No PO history yet.</Empty>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthlyPo}>
              <defs>
                <linearGradient id="grad-po" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e6ab0" stopOpacity={0.5} /><stop offset="100%" stopColor="#1e6ab0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number, name: string) => name === "Value" ? fmtAED(v) : v} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area yAxisId="right" type="monotone" dataKey="value" stroke="#1e6ab0" strokeWidth={2} fill="url(#grad-po)" name="Value" />
              <Area yAxisId="left"  type="monotone" dataKey="pos"   stroke="#0f2d5a" strokeWidth={2} fillOpacity={0}     name="POs" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </PanelCard>

      {/* Top suppliers + pending approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] flex items-center justify-center shadow">
                <Crown className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold">Top Suppliers · By Spend</div>
                <div className="text-[11px] text-muted-foreground">Cumulative PO value</div>
              </div>
            </div>
            <Link href="/procurement/suppliers" className="text-[11px] text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {topSuppliers.length === 0 ? (
            <Empty>No supplier spend yet.</Empty>
          ) : (
            <div className="space-y-2">
              {topSuppliers.map((s, i) => (
                <div key={s.name} className="border rounded-xl p-2.5 hover:bg-muted/40 transition-all flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${i === 0 ? "bg-gradient-to-br from-amber-500 to-orange-600" : i === 1 ? "bg-gradient-to-br from-slate-400 to-slate-500" : i === 2 ? "bg-gradient-to-br from-orange-400 to-amber-700" : "bg-[#1e6ab0]"}`}>
                    {i + 1}
                  </div>
                  <Avatar name={s.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">{s.count} PO{s.count === 1 ? "" : "s"}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-[#0f2d5a] dark:text-white">{fmtAED(s.value)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <PanelCard title="Pending PRs" subtitle={`${pendingPrs.length} awaiting approval`} icon={Clock}>
            {pendingPrs.length === 0 ? (
              <Empty>None pending.</Empty>
            ) : (
              <div className="space-y-1.5">
                {pendingPrs.map((p: any) => (
                  <Link key={p.id} href="/procurement/purchase-requests" className="block">
                    <div className="border rounded-lg p-2 hover:bg-muted/40 transition-all">
                      <div className="text-[11px] font-mono text-primary">{p.prNumber ?? p.requestNumber ?? `#${p.id}`}</div>
                      <div className="text-sm font-medium truncate">{p.title ?? p.description ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">{p.requestedByName ?? "—"} · {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short" }) : "—"}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </PanelCard>
          <PanelCard title="Pending POs" subtitle={`${pendingPos.length} awaiting approval`} icon={Clock}>
            {pendingPos.length === 0 ? (
              <Empty>None pending.</Empty>
            ) : (
              <div className="space-y-1.5">
                {pendingPos.map((p: any) => (
                  <Link key={p.id} href={`/procurement/purchase-orders/${p.id}`} className="block">
                    <div className="border rounded-lg p-2 hover:bg-muted/40 transition-all">
                      <div className="text-[11px] font-mono text-primary">{p.poNumber ?? `#${p.id}`}</div>
                      <div className="text-sm font-medium truncate">{p.supplierName ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">{fmtAED(Number(p.grandTotal ?? p.totalAmount ?? 0))}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </PanelCard>
        </div>
      </div>
    </div>
  );
}

function PanelCard({ title, subtitle, icon: Icon, children, className = "" }: {
  title: string; subtitle?: string; icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-card border rounded-2xl p-4 space-y-3 shadow-sm ${className}`}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground italic py-6 text-center">{children}</div>;
}
