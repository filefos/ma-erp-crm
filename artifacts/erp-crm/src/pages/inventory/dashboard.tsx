import { useMemo } from "react";
import { Link } from "wouter";
import {
  useListInventoryItems, useListStockEntries,
  useListPurchaseOrders, useListLpos, useListSuppliers,
} from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Button } from "@/components/ui/button";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid, Area, AreaChart,
} from "recharts";
import {
  Package, Boxes, AlertTriangle, ShoppingCart, ClipboardList,
  ArrowDownCircle, ArrowUpCircle, Truck, Plus, Sparkles,
  Layers, FileBox, Building2, TrendingUp, Users2,
} from "lucide-react";
import {
  ExecutiveHeader, KPIWidget, PremiumCard, StatusBadge, Avatar,
  weeklyCounts, weeklyValues, trendPct,
} from "@/components/crm/premium";

const PO_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  sent: "#3b82f6",
  confirmed: "#8b5cf6",
  partial: "#f97316",
  received: "#10b981",
  cancelled: "#ef4444",
};

const LPO_COLORS: Record<string, string> = {
  active: "#10b981",
  closed: "#64748b",
  cancelled: "#ef4444",
  draft: "#94a3b8",
};

const CATEGORY_PALETTE = [
  "#0f2d5a", "#1e6ab0", "#3b82f6", "#10b981", "#8b5cf6",
  "#f97316", "#ef4444", "#14b8a6", "#6366f1", "#64748b",
];

function fmtAED(n: number) {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(1)}K`;
  return `AED ${n.toFixed(0)}`;
}

function fmtNum(n: number) {
  return n.toLocaleString();
}

function daysSince(d: string | Date | null | undefined) {
  if (!d) return Infinity;
  const ms = Date.now() - new Date(d).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function InventoryDashboard() {
  const { filterByCompany } = useActiveCompany();
  const { data: itemsRaw, isLoading: itemsLoading } = useListInventoryItems();
  const { data: entriesRaw } = useListStockEntries();
  const { data: posRaw } = useListPurchaseOrders();
  const { data: lposRaw } = useListLpos();
  const { data: suppliers } = useListSuppliers();

  const items = useMemo(() => filterByCompany(itemsRaw ?? []), [itemsRaw, filterByCompany]);
  const entries = useMemo(() => filterByCompany(entriesRaw ?? []), [entriesRaw, filterByCompany]);
  const pos = useMemo(() => filterByCompany(posRaw ?? []), [posRaw, filterByCompany]);
  const lpos = useMemo(() => filterByCompany(lposRaw ?? []), [lposRaw, filterByCompany]);

  // ===== KPIs =====
  const totalItems = items.length;
  const lowStockItems = items.filter(i => i.currentStock <= i.minimumStock && i.currentStock > 0);
  const outOfStockItems = items.filter(i => i.currentStock <= 0);
  const totalStockValue = items.reduce((s, i) => s + (i.currentStock * (i.unitCost ?? 0)), 0);

  const openPOs = pos.filter(p => ["draft", "sent", "confirmed", "partial"].includes(p.status));
  const openPOValue = openPOs.reduce((s, p) => s + (p.total ?? 0), 0);
  const totalPOValue = pos.reduce((s, p) => s + (p.total ?? 0), 0);

  const activeLpos = lpos.filter(l => l.status === "active");
  const totalLpoValue = lpos.reduce((s, l) => s + (l.lpoValue ?? 0), 0);
  const activeLpoValue = activeLpos.reduce((s, l) => s + (l.lpoValue ?? 0), 0);

  // ===== Trends (sparklines) =====
  const itemsSpark = weeklyCounts(items, "createdAt", 8);
  const lowStockSpark = weeklyCounts(entries.filter(e => e.type === "stock_out"), "createdAt", 8);
  const stockValueSpark = weeklyValues(
    entries.filter(e => e.type === "stock_in"),
    "createdAt",
    (e: any) => Number(e.quantity ?? 0),
    8,
  );
  const poSpark = weeklyCounts(pos, "createdAt", 8);
  const poValSpark = weeklyValues(pos, "createdAt", (p: any) => Number(p.total ?? 0), 8);
  const lpoSpark = weeklyCounts(lpos, "createdAt", 8);
  const lpoValSpark = weeklyValues(lpos, "createdAt", (l: any) => Number(l.lpoValue ?? 0), 8);

  const itemsTrend = trendPct(itemsSpark);
  const poValTrend = trendPct(poValSpark);
  const lpoValTrend = trendPct(lpoValSpark);
  const stockValTrend = trendPct(stockValueSpark);

  // ===== Stock movements 30-day chart =====
  const movements30d = useMemo(() => {
    const days: { day: string; in: number; out: number; net: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const dayEntries = entries.filter(e => {
        const ts = new Date(e.createdAt as any).getTime();
        return ts >= d.getTime() && ts < next.getTime();
      });
      const stockIn = dayEntries.filter(e => e.type === "stock_in").reduce((s, e) => s + (e.quantity ?? 0), 0);
      const stockOut = dayEntries.filter(e => e.type === "stock_out").reduce((s, e) => s + (e.quantity ?? 0), 0);
      days.push({
        day: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
        in: Math.round(stockIn),
        out: Math.round(stockOut),
        net: Math.round(stockIn - stockOut),
      });
    }
    return days;
  }, [entries]);

  // ===== Stock value by category =====
  const byCategory = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    items.forEach(i => {
      const cat = i.category || "Uncategorized";
      if (!map[cat]) map[cat] = { count: 0, value: 0 };
      map[cat].count += 1;
      map[cat].value += i.currentStock * (i.unitCost ?? 0);
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, count: v.count, value: Math.round(v.value) }))
      .sort((a, b) => b.value - a.value);
  }, [items]);

  // ===== PO status breakdown =====
  const poByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    pos.forEach(p => { map[p.status] = (map[p.status] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [pos]);

  // ===== LPO status breakdown =====
  const lpoByStatus = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    lpos.forEach(l => {
      if (!map[l.status]) map[l.status] = { count: 0, value: 0 };
      map[l.status].count += 1;
      map[l.status].value += (l.lpoValue ?? 0);
    });
    return Object.entries(map).map(([name, v]) => ({ name, count: v.count, value: Math.round(v.value) }));
  }, [lpos]);

  // ===== Top suppliers from PO data =====
  const topSuppliers = useMemo(() => {
    const map = new Map<number, { name: string; orders: number; value: number }>();
    pos.forEach(p => {
      const sid = (p as any).supplierId as number | undefined;
      if (!sid) return;
      const supplier = suppliers?.find(s => s.id === sid);
      const name = supplier?.name ?? (p as any).supplierName ?? `Supplier #${sid}`;
      const cur = map.get(sid) ?? { name, orders: 0, value: 0 };
      cur.orders += 1;
      cur.value += (p.total ?? 0);
      map.set(sid, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [pos, suppliers]);

  // ===== Top clients from LPO data =====
  const topClients = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; value: number }>();
    lpos.forEach(l => {
      const name = l.clientName || "Unknown";
      const cur = map.get(name) ?? { name, orders: 0, value: 0 };
      cur.orders += 1;
      cur.value += (l.lpoValue ?? 0);
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [lpos]);

  // ===== Recent stock movements =====
  const recentMovements = useMemo(() => {
    return [...entries]
      .sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())
      .slice(0, 8)
      .map(e => ({
        ...e,
        itemName: items.find(i => i.id === e.itemId)?.name ?? `Item #${e.itemId}`,
      }));
  }, [entries, items]);

  // ===== Stale POs (sent/confirmed > 14 days, not received) =====
  const stalePOs = useMemo(() => {
    return pos.filter(p =>
      ["sent", "confirmed", "partial"].includes(p.status) &&
      daysSince(p.createdAt as any) > 14,
    ).slice(0, 5);
  }, [pos]);

  // ===== AI Insights summary =====
  const insights: { tone: "red" | "amber" | "blue" | "green"; text: string; cta?: { href: string; label: string } }[] = [];
  if (outOfStockItems.length > 0) {
    insights.push({ tone: "red", text: `${outOfStockItems.length} item${outOfStockItems.length > 1 ? "s are" : " is"} out of stock — reorder now`, cta: { href: "/inventory/items", label: "View items" } });
  }
  if (lowStockItems.length > 0) {
    insights.push({ tone: "amber", text: `${lowStockItems.length} item${lowStockItems.length > 1 ? "s" : ""} below minimum — plan replenishment`, cta: { href: "/inventory/items", label: "View low stock" } });
  }
  if (stalePOs.length > 0) {
    insights.push({ tone: "amber", text: `${stalePOs.length} purchase order${stalePOs.length > 1 ? "s have" : " has"} been pending for 14+ days`, cta: { href: "/procurement/purchase-orders", label: "Review POs" } });
  }
  if (openPOs.length === 0 && totalItems > 0) {
    insights.push({ tone: "blue", text: "No open purchase orders right now — verify reorder coverage", cta: { href: "/procurement/purchase-orders", label: "Create PO" } });
  }
  if (activeLpos.length > 0) {
    insights.push({ tone: "green", text: `${activeLpos.length} active sales order${activeLpos.length > 1 ? "s" : ""} worth ${fmtAED(activeLpoValue)} in delivery pipeline` });
  }
  if (insights.length === 0) {
    insights.push({ tone: "green", text: "All inventory KPIs are healthy — no immediate actions required" });
  }

  if (itemsLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading inventory dashboard…</div>;
  }

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button asChild size="sm" className="bg-white text-[#0f2d5a] hover:bg-white/90 h-8">
        <Link href="/inventory/items"><Plus className="w-3.5 h-3.5 mr-1.5" />Item</Link>
      </Button>
      <Button asChild size="sm" variant="outline" className="bg-white/15 hover:bg-white/25 border-white/20 text-white h-8">
        <Link href="/inventory/stock-entries"><Plus className="w-3.5 h-3.5 mr-1.5" />Stock Entry</Link>
      </Button>
      <Button asChild size="sm" variant="outline" className="bg-white/15 hover:bg-white/25 border-white/20 text-white h-8">
        <Link href="/procurement/purchase-orders"><Plus className="w-3.5 h-3.5 mr-1.5" />PO</Link>
      </Button>
      <Button asChild size="sm" variant="outline" className="bg-white/15 hover:bg-white/25 border-white/20 text-white h-8">
        <Link href="/sales/lpos"><Plus className="w-3.5 h-3.5 mr-1.5" />LPO</Link>
      </Button>
    </div>
  );

  return (
    <div className="space-y-5 pb-8">
      <ExecutiveHeader
        icon={Boxes}
        title="Inventory Command Center"
        subtitle="Live view of stock, purchase orders and sales orders across all warehouses"
      >
        {headerActions}
      </ExecutiveHeader>

      {/* AI Insights */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#0f2d5a] to-[#1e6ab0]" />
        <div className="p-4 pl-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0f2d5a]/5 text-[#0f2d5a] dark:bg-[#1e6ab0]/15 dark:text-[#7eb9f0]">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">AI Inventory Insights</span>
            </div>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              live
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {insights.slice(0, 6).map((ins, i) => {
              const toneClass = ins.tone === "red"
                ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900 text-red-700 dark:text-red-400"
                : ins.tone === "amber"
                ? "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900 text-orange-700 dark:text-orange-400"
                : ins.tone === "green"
                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400"
                : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900 text-blue-700 dark:text-blue-400";
              return (
                <div key={i} className={`flex items-start justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${toneClass}`}>
                  <span>{ins.text}</span>
                  {ins.cta && (
                    <Button asChild variant="ghost" size="sm" className="h-6 px-2 text-[11px] shrink-0">
                      <Link href={ins.cta.href}>{ins.cta.label}</Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIWidget
          tone="navy" icon={Layers} label="Total Items" value={fmtNum(totalItems)}
          sub="In master catalog" sparkline={itemsSpark} trend={itemsTrend} href="/inventory/items"
        />
        <KPIWidget
          tone="blue" icon={Package} label="Stock Value" value={fmtAED(totalStockValue)}
          sub="On-hand inventory" sparkline={stockValueSpark} trend={stockValTrend}
        />
        <KPIWidget
          tone="amber" icon={AlertTriangle} label="Low Stock" value={fmtNum(lowStockItems.length)}
          sub="Below minimum level" sparkline={lowStockSpark} href="/inventory/items"
        />
        <KPIWidget
          tone="red" icon={AlertTriangle} label="Out of Stock" value={fmtNum(outOfStockItems.length)}
          sub="Need immediate reorder" href="/inventory/items"
        />
        <KPIWidget
          tone="purple" icon={ShoppingCart} label="Open POs" value={fmtNum(openPOs.length)}
          sub={`of ${pos.length} total`} sparkline={poSpark} href="/procurement/purchase-orders"
        />
        <KPIWidget
          tone="indigo" icon={Truck} label="PO Value Pending" value={fmtAED(openPOValue)}
          sub={`${fmtAED(totalPOValue)} all-time`} sparkline={poValSpark} trend={poValTrend}
          href="/procurement/purchase-orders"
        />
        <KPIWidget
          tone="teal" icon={ClipboardList} label="Active Sales Orders" value={fmtNum(activeLpos.length)}
          sub={`of ${lpos.length} total LPOs`} sparkline={lpoSpark} href="/sales/lpos"
        />
        <KPIWidget
          tone="green" icon={TrendingUp} label="Sales Order Value" value={fmtAED(activeLpoValue)}
          sub={`${fmtAED(totalLpoValue)} all-time`} sparkline={lpoValSpark} trend={lpoValTrend}
          href="/sales/lpos"
        />
      </div>

      {/* Stock Movement 30d trend + Category donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PremiumCard className="lg:col-span-2">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  <FileBox className="w-4 h-4 text-[#1e6ab0]" />
                  Stock Movements — Last 30 Days
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Daily stock-in vs stock-out activity</div>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />In</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" />Out</span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={movements30d}>
                  <defs>
                    <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(movements30d.length / 8) - 1)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="in" stroke="#10b981" strokeWidth={2} fill="url(#inGrad)" />
                  <Area type="monotone" dataKey="out" stroke="#ef4444" strokeWidth={2} fill="url(#outGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard tone="navy" className="text-white">
          <div className="p-5">
            <div className="text-sm font-semibold flex items-center gap-2 text-white">
              <Layers className="w-4 h-4" />
              Stock Value by Category
            </div>
            <div className="text-[11px] text-white/70 mt-0.5">{fmtAED(totalStockValue)} total</div>
            <div className="h-48 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byCategory.slice(0, 8)} dataKey="value" nameKey="name"
                    innerRadius={42} outerRadius={70} paddingAngle={2}
                  >
                    {byCategory.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]} stroke="rgba(255,255,255,0.2)" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => fmtAED(Number(v))}
                    contentStyle={{ background: "rgba(15, 45, 90, 0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11, color: "white" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1">
              {byCategory.slice(0, 5).map((c, i) => (
                <div key={c.name} className="flex items-center justify-between text-[11px] gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }} />
                    <span className="truncate">{c.name}</span>
                  </div>
                  <span className="tabular-nums font-medium shrink-0">{fmtAED(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </PremiumCard>
      </div>

      {/* Low Stock Reorder Alerts */}
      <PremiumCard tone="amber">
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              Reorder Alerts
              <span className="text-[11px] font-normal text-muted-foreground">({lowStockItems.length + outOfStockItems.length} items)</span>
            </div>
            <Button asChild size="sm" variant="outline" className="h-7">
              <Link href="/procurement/purchase-orders">Create PO</Link>
            </Button>
          </div>
          {(lowStockItems.length + outOfStockItems.length) === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">All items above minimum stock level — no reorder needed.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[...outOfStockItems, ...lowStockItems].slice(0, 9).map(item => {
                const isOut = item.currentStock <= 0;
                const reorderQty = Math.max(item.minimumStock * 2 - item.currentStock, item.minimumStock);
                return (
                  <Link key={item.id} href="/inventory/items" className="block">
                    <div className={`p-3 rounded-lg border bg-card hover:shadow-md transition-all ${isOut ? "border-red-300 dark:border-red-800" : "border-orange-300 dark:border-orange-800"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-mono text-muted-foreground">{item.itemCode}</div>
                          <div className="text-sm font-semibold truncate">{item.name}</div>
                          <div className="text-[11px] text-muted-foreground">{item.category}</div>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${isOut ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"}`}>
                          {isOut ? "OUT" : "LOW"}
                        </span>
                      </div>
                      <div className="flex items-end justify-between mt-2">
                        <div className="text-[11px] text-muted-foreground">
                          {item.currentStock} / {item.minimumStock} {item.unit}
                        </div>
                        <div className="text-[11px] font-semibold text-[#0f2d5a] dark:text-[#7eb9f0]">
                          Reorder ~{Math.round(reorderQty)} {item.unit}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </PremiumCard>

      {/* PO + LPO status side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PremiumCard>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-purple-600" />
                  Purchase Orders by Status
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{pos.length} total · {fmtAED(totalPOValue)}</div>
              </div>
              <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                <Link href="/procurement/purchase-orders">Open →</Link>
              </Button>
            </div>
            {pos.length === 0 ? (
              <div className="text-xs text-muted-foreground py-8 text-center">No purchase orders yet.</div>
            ) : (
              <div className="grid grid-cols-5 gap-3 items-center">
                <div className="col-span-2 h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={poByStatus} dataKey="value" nameKey="name" innerRadius={32} outerRadius={62} paddingAngle={2}>
                        {poByStatus.map((s, i) => (
                          <Cell key={i} fill={PO_COLORS[s.name] ?? CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="col-span-3 space-y-1.5">
                  {poByStatus.map(s => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PO_COLORS[s.name] ?? "#94a3b8" }} />
                        <span className="capitalize truncate">{s.name}</span>
                      </div>
                      <span className="font-semibold tabular-nums">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PremiumCard>

        <PremiumCard>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-teal-600" />
                  Sales Orders (LPOs) by Status
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{lpos.length} total · {fmtAED(totalLpoValue)}</div>
              </div>
              <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                <Link href="/sales/lpos">Open →</Link>
              </Button>
            </div>
            {lpos.length === 0 ? (
              <div className="text-xs text-muted-foreground py-8 text-center">No sales orders / LPOs yet.</div>
            ) : (
              <div className="space-y-2">
                {lpoByStatus.map(s => {
                  const pct = totalLpoValue > 0 ? (s.value / totalLpoValue) * 100 : 0;
                  return (
                    <div key={s.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={s.name} />
                          <span className="text-muted-foreground">{s.count} order{s.count !== 1 ? "s" : ""}</span>
                        </div>
                        <span className="font-semibold tabular-nums">{fmtAED(s.value)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: LPO_COLORS[s.name] ?? "#1e6ab0" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PremiumCard>
      </div>

      {/* Top Suppliers + Top Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PremiumCard>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                Top Suppliers <span className="text-[11px] font-normal text-muted-foreground">by PO value</span>
              </div>
              <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                <Link href="/procurement/suppliers">All →</Link>
              </Button>
            </div>
            {topSuppliers.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">No supplier activity yet.</div>
            ) : (
              <div className="space-y-2.5">
                {topSuppliers.map((s, i) => {
                  const max = topSuppliers[0].value || 1;
                  const pct = (s.value / max) * 100;
                  return (
                    <div key={`${s.name}-${i}`}>
                      <div className="flex items-center justify-between text-xs mb-1 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={s.name} size={22} />
                          <span className="font-medium truncate">{s.name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">· {s.orders} PO{s.orders > 1 ? "s" : ""}</span>
                        </div>
                        <span className="font-semibold tabular-nums shrink-0">{fmtAED(s.value)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PremiumCard>

        <PremiumCard>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Users2 className="w-4 h-4 text-teal-600" />
                Top Clients <span className="text-[11px] font-normal text-muted-foreground">by sales-order value</span>
              </div>
              <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                <Link href="/sales/lpos">All →</Link>
              </Button>
            </div>
            {topClients.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">No client orders recorded.</div>
            ) : (
              <div className="space-y-2.5">
                {topClients.map((c, i) => {
                  const max = topClients[0].value || 1;
                  const pct = (c.value / max) * 100;
                  return (
                    <div key={`${c.name}-${i}`}>
                      <div className="flex items-center justify-between text-xs mb-1 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={c.name} size={22} />
                          <span className="font-medium truncate">{c.name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">· {c.orders} LPO{c.orders > 1 ? "s" : ""}</span>
                        </div>
                        <span className="font-semibold tabular-nums shrink-0">{fmtAED(c.value)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PremiumCard>
      </div>

      {/* Recent stock movements */}
      <PremiumCard>
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              <FileBox className="w-4 h-4 text-[#1e6ab0]" />
              Recent Stock Movements
            </div>
            <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
              <Link href="/inventory/stock-entries">All entries →</Link>
            </Button>
          </div>
          {recentMovements.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No stock movements recorded yet.</div>
          ) : (
            <div className="divide-y">
              {recentMovements.map(m => {
                const isIn = m.type === "stock_in";
                const isOut = m.type === "stock_out";
                const Icon = isIn ? ArrowDownCircle : isOut ? ArrowUpCircle : Package;
                const color = isIn ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                  : isOut ? "text-red-600 bg-red-50 dark:bg-red-900/20"
                  : "text-orange-600 bg-orange-50 dark:bg-orange-900/20";
                return (
                  <div key={m.id} className="flex items-center justify-between py-2 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{m.itemName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          <span className="capitalize">{m.type.replace("_", " ")}</span>
                          {m.reference ? ` · ${m.reference}` : ""}
                          {" · "}
                          {new Date(m.createdAt as any).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-bold tabular-nums ${isIn ? "text-emerald-600" : isOut ? "text-red-600" : "text-orange-600"}`}>
                        {isOut ? "−" : "+"}{m.quantity}
                      </div>
                      <div className="text-[10px] text-muted-foreground capitalize">{m.approvalStatus}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PremiumCard>
    </div>
  );
}
