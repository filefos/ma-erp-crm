import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useListPurchaseOrders, useListSuppliers } from "@workspace/api-client-react";
import { DashboardScreen } from "@/components/Dashboard";
import { Card, EmptyState, KpiGrid, KpiTile, SectionHeading } from "@/components/ui";
import { fmtCompact, num } from "@/lib/format";
import { inRange, useReportFilters } from "@/components/forms/ReportFilters";

export default function ProcurementReport() {
  const { state, filters } = useReportFilters("12mo");
  const { from, to, companyId } = state;
  const ordersQ = useListPurchaseOrders();
  const suppliersQ = useListSuppliers();

  const orders = useMemo(
    () => (ordersQ.data ?? []).filter(o => {
      if (companyId != null && (o as { companyId?: number }).companyId !== companyId) return false;
      const d = (o as { orderDate?: string; createdAt?: string }).orderDate ?? (o as { createdAt?: string }).createdAt;
      return inRange(d, from, to);
    }),
    [ordersQ.data, companyId, from, to],
  );
  const suppliers = useMemo(
    () => (suppliersQ.data ?? []).filter(s => companyId == null || (s as { companyId?: number }).companyId === companyId),
    [suppliersQ.data, companyId],
  );

  const totalSpend = orders.filter(o => ["confirmed", "received"].includes(o.status ?? ""))
    .reduce((s, o) => s + num((o as { total?: number }).total), 0);
  const activeSuppliers = suppliers.filter(s => (s as { isActive?: boolean }).isActive).length;
  const draft = orders.filter(o => o.status === "draft").length;
  const received = orders.filter(o => o.status === "received").length;

  const bySupplier = useMemo(() => {
    const m: Record<string, { name: string; value: number; count: number }> = {};
    for (const po of orders) {
      const id = String((po as { supplierId?: number }).supplierId ?? "—");
      const name = (po as { supplierName?: string }).supplierName ?? `Supplier #${id}`;
      if (!m[id]) m[id] = { name, value: 0, count: 0 };
      m[id].value += num((po as { total?: number }).total);
      m[id].count += 1;
    }
    return Object.values(m).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [orders]);

  const max = Math.max(...bySupplier.map(b => b.value), 1);

  return (
    <DashboardScreen title="Procurement spend" subtitle={`${orders.length} purchase orders`}>
      {filters}
      <SectionHeading title="Snapshot" />
      <KpiGrid>
        <KpiTile label="Total POs" value={orders.length} icon="shopping-cart" tone="navy" />
        <KpiTile label="Spend" value={`AED ${fmtCompact(totalSpend)}`} icon="dollar-sign" tone="blue" />
        <KpiTile label="Suppliers" value={activeSuppliers} icon="users" tone="muted" />
        <KpiTile label="Draft / Received" value={`${draft} / ${received}`} icon="layers" tone="orange" />
      </KpiGrid>

      <SectionHeading title="Top suppliers" />
      {bySupplier.length === 0 ? <EmptyState icon="shopping-bag" title="No purchase orders in range" /> : null}
      {bySupplier.map(b => (
        <Card key={b.name}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 }} numberOfLines={1}>{b.name}</Text>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13 }}>AED {fmtCompact(b.value)}</Text>
          </View>
          <View style={{ height: 6, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
            <View style={{ height: 6, width: `${(b.value / max) * 100}%`, backgroundColor: "#0f2d5a" }} />
          </View>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#64748b", marginTop: 4 }}>{b.count} order{b.count === 1 ? "" : "s"}</Text>
        </Card>
      ))}
    </DashboardScreen>
  );
}
