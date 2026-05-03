import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useListExpenses, useListTaxInvoices } from "@workspace/api-client-react";
import { DashboardScreen } from "@/components/Dashboard";
import { Card, EmptyState, KpiGrid, KpiTile, SectionHeading } from "@/components/ui";
import { fmtCompact, num } from "@/lib/format";
import { inRange, useReportFilters } from "@/components/forms/ReportFilters";

export default function ProfitMarginReport() {
  const { state, filters } = useReportFilters("12mo");
  const { from, to, companyId } = state;
  const inv = useListTaxInvoices(companyId ? { companyId } : {});
  const exp = useListExpenses(companyId ? { companyId } : {});
  const invoices = useMemo(
    () => (inv.data ?? []).filter(i => inRange((i as { invoiceDate?: string; createdAt?: string }).invoiceDate ?? (i as { createdAt?: string }).createdAt, from, to)),
    [inv.data, from, to],
  );
  const expenses = useMemo(
    () => (exp.data ?? []).filter(e => inRange(e.paymentDate ?? e.createdAt, from, to)),
    [exp.data, from, to],
  );

  const revenue = invoices.reduce((s, i) => s + num((i as { grandTotal?: number }).grandTotal), 0);
  const cost = expenses.filter(e => e.status !== "rejected").reduce((s, e) => s + num(e.total), 0);
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const byMonth = useMemo(() => {
    const m: Record<string, { rev: number; cost: number }> = {};
    for (const i of invoices) {
      const d = (i as { invoiceDate?: string; createdAt?: string }).invoiceDate || (i as { createdAt?: string }).createdAt;
      if (!d) continue;
      const k = d.slice(0, 7);
      m[k] = m[k] ?? { rev: 0, cost: 0 };
      m[k].rev += num((i as { grandTotal?: number }).grandTotal);
    }
    for (const e of expenses) {
      const d = e.paymentDate || e.createdAt;
      if (!d) continue;
      const k = d.slice(0, 7);
      m[k] = m[k] ?? { rev: 0, cost: 0 };
      if (e.status !== "rejected") m[k].cost += num(e.total);
    }
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [invoices, expenses]);

  const max = Math.max(...byMonth.map(([, v]) => Math.max(v.rev, v.cost)), 1);

  return (
    <DashboardScreen title="Profit margin" subtitle="Revenue vs expenses">
      {filters}
      <SectionHeading title="Snapshot" />
      <KpiGrid>
        <KpiTile label="Revenue" value={`AED ${fmtCompact(revenue)}`} icon="trending-up" tone="blue" />
        <KpiTile label="Costs" value={`AED ${fmtCompact(cost)}`} icon="trending-down" tone="orange" />
        <KpiTile label="Profit" value={`AED ${fmtCompact(profit)}`} icon="dollar-sign" tone="navy" />
        <KpiTile label="Margin" value={`${margin.toFixed(1)}%`} icon="percent" tone="muted" />
      </KpiGrid>

      <SectionHeading title="By month" />
      {byMonth.length === 0 ? <EmptyState icon="bar-chart-2" title="No data in range" /> : null}
      {byMonth.map(([k, v]) => {
        const p = v.rev - v.cost;
        return (
          <Card key={k}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{k}</Text>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: p >= 0 ? "#16a34a" : "#dc2626" }}>
                AED {fmtCompact(p)}
              </Text>
            </View>
            <View style={{ height: 4, backgroundColor: "rgba(0,0,0,0.04)", borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
              <View style={{ height: 4, width: `${(v.rev / max) * 100}%`, backgroundColor: "#1e6ab0" }} />
            </View>
            <View style={{ height: 4, backgroundColor: "rgba(0,0,0,0.04)", borderRadius: 2, overflow: "hidden" }}>
              <View style={{ height: 4, width: `${(v.cost / max) * 100}%`, backgroundColor: "#f97316" }} />
            </View>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#64748b", marginTop: 4 }}>
              Rev AED {fmtCompact(v.rev)} · Cost AED {fmtCompact(v.cost)}
            </Text>
          </Card>
        );
      })}
    </DashboardScreen>
  );
}
