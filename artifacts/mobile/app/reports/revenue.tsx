import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useListTaxInvoices } from "@workspace/api-client-react";
import { DashboardScreen } from "@/components/Dashboard";
import { Card, EmptyState, KpiGrid, KpiTile, SectionHeading } from "@/components/ui";
import { fmtCompact, num } from "@/lib/format";
import { inRange, useReportFilters } from "@/components/forms/ReportFilters";

export default function RevenueReport() {
  const { state, filters } = useReportFilters("12mo");
  const { from, to, companyId } = state;
  const q = useListTaxInvoices(companyId ? { companyId } : {});
  const all = q.data ?? [];
  const invoices = useMemo(
    () => all.filter(i => inRange((i as { invoiceDate?: string; createdAt?: string }).invoiceDate ?? (i as { createdAt?: string }).createdAt, from, to)),
    [all, from, to],
  );

  const total = invoices.reduce((s, i) => s + num((i as { grandTotal?: number }).grandTotal), 0);
  const collected = invoices.filter(i => (i as { paymentStatus?: string }).paymentStatus === "paid").reduce((s, i) => s + num((i as { grandTotal?: number }).grandTotal), 0);
  const outstanding = invoices.filter(i => (i as { paymentStatus?: string }).paymentStatus !== "paid").reduce((s, i) => s + num((i as { grandTotal?: number }).grandTotal), 0);

  const byMonth = useMemo(() => {
    const m: Record<string, number> = {};
    for (const inv of invoices) {
      const d = (inv as { invoiceDate?: string; createdAt?: string }).invoiceDate || (inv as { createdAt?: string }).createdAt;
      if (!d) continue;
      const key = d.slice(0, 7);
      m[key] = (m[key] ?? 0) + num((inv as { grandTotal?: number }).grandTotal);
    }
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [invoices]);

  const max = Math.max(...byMonth.map(([, v]) => v), 1);

  return (
    <DashboardScreen title="Revenue" subtitle={`${invoices.length} tax invoices`}>
      {filters}
      <SectionHeading title="Snapshot" />
      <KpiGrid>
        <KpiTile label="Total billed" value={`AED ${fmtCompact(total)}`} icon="dollar-sign" tone="navy" />
        <KpiTile label="Collected" value={`AED ${fmtCompact(collected)}`} icon="check-circle" tone="blue" />
        <KpiTile label="Outstanding" value={`AED ${fmtCompact(outstanding)}`} icon="clock" tone="orange" />
        <KpiTile label="Invoices" value={invoices.length} icon="file-text" tone="muted" />
      </KpiGrid>

      <SectionHeading title="By month" />
      {byMonth.length === 0 ? <EmptyState icon="bar-chart-2" title="No revenue in range" /> : null}
      {byMonth.map(([month, value]) => (
        <Card key={month}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{month}</Text>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13 }}>AED {fmtCompact(value)}</Text>
          </View>
          <View style={{ height: 6, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
            <View style={{ height: 6, width: `${(value / max) * 100}%`, backgroundColor: "#1e6ab0" }} />
          </View>
        </Card>
      ))}
    </DashboardScreen>
  );
}
