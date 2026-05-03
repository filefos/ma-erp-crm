import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useListExpenses } from "@workspace/api-client-react";
import { DashboardScreen } from "@/components/Dashboard";
import { Card, EmptyState, KpiGrid, KpiTile, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { expenseCategoryLabel, expenseStatusMeta, fmtCompact, num } from "@/lib/format";
import { inRange, useReportFilters } from "@/components/forms/ReportFilters";

export default function ExpensesReport() {
  const { state, filters } = useReportFilters("12mo");
  const { from, to, companyId } = state;
  const q = useListExpenses(companyId ? { companyId } : {});
  const all = q.data ?? [];
  const expenses = useMemo(
    () => all.filter(e => inRange(e.paymentDate ?? e.createdAt, from, to)),
    [all, from, to],
  );

  const total = expenses.reduce((s, e) => s + num(e.total), 0);
  const approved = expenses.filter(e => e.status === "approved").reduce((s, e) => s + num(e.total), 0);
  const pending = expenses.filter(e => e.status === "pending").length;
  const rejected = expenses.filter(e => e.status === "rejected").length;

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of expenses) {
      const k = e.category ?? "other";
      m[k] = (m[k] ?? 0) + num(e.total);
    }
    return Object.entries(m).map(([k, v]) => ({ key: k, label: expenseCategoryLabel(k), value: v }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [expenses]);

  const max = Math.max(...byCategory.map(b => b.value), 1);

  const recent = useMemo(
    () => expenses.slice().sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 8),
    [expenses],
  );

  return (
    <DashboardScreen title="Expenses" subtitle={`${expenses.length} entries`}>
      {filters}
      <SectionHeading title="Snapshot" />
      <KpiGrid>
        <KpiTile label="Total" value={`AED ${fmtCompact(total)}`} icon="credit-card" tone="navy" />
        <KpiTile label="Approved" value={`AED ${fmtCompact(approved)}`} icon="check-circle" tone="blue" />
        <KpiTile label="Pending" value={pending} icon="clock" tone="orange" />
        <KpiTile label="Rejected" value={rejected} icon="x-circle" tone="muted" />
      </KpiGrid>

      <SectionHeading title="By category" />
      {byCategory.length === 0 ? <EmptyState icon="pie-chart" title="No expenses in range" /> : null}
      {byCategory.map(b => (
        <Card key={b.key}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{b.label}</Text>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13 }}>AED {fmtCompact(b.value)}</Text>
          </View>
          <View style={{ height: 6, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
            <View style={{ height: 6, width: `${(b.value / max) * 100}%`, backgroundColor: "#f97316" }} />
          </View>
        </Card>
      ))}

      <SectionHeading title="Recent" />
      {recent.map(e => {
        const sm = expenseStatusMeta(e.status);
        return (
          <Card key={e.id}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 }} numberOfLines={1}>
                {e.expenseNumber} · {expenseCategoryLabel(e.category)}
              </Text>
              <StatusPill label={sm.label} tone={sm.tone} />
            </View>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#64748b", marginTop: 2 }}>
              AED {fmtCompact(num(e.total))} · {e.supplierName ?? "—"}
            </Text>
          </Card>
        );
      })}
    </DashboardScreen>
  );
}
