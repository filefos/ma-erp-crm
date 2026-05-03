import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListExpenses } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { EXPENSE_STATUSES, expenseCategoryLabel, expenseStatusMeta, fmtAed, fmtDate } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

export default function ExpensesList() {
  const c = useColors();
  const router = useRouter();
  const { activeCompanyId } = useApp();
  const [status, setStatus] = useState("");
  const q = useListExpenses({ companyId: activeCompanyId ?? undefined, ...(status ? { status } : {}) });
  const data = useMemo(
    () => (q.data ?? []).filter(e => activeCompanyId == null || e.companyId === activeCompanyId || e.companyId == null),
    [q.data, activeCompanyId],
  );

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Expenses" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Select label="Status" value={status} options={[{ value: "", label: "All statuses" }, ...EXPENSE_STATUSES]} onChange={setStatus} />
        <BrandButton label="New expense" icon="plus" onPress={() => router.push("/accounts/expenses/new")} />

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="trending-down" title="No expenses" hint="Record your first expense." /> : null}

        {data.map(e => {
          const sm = expenseStatusMeta(e.status);
          return (
            <Pressable key={e.id} onPress={() => router.push({ pathname: "/accounts/expenses/[id]", params: { id: String(e.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{e.expenseNumber}</Text>
                  <StatusPill label={sm.label} tone={sm.tone} />
                </View>
                <Text style={[styles.body, { color: c.foreground }]} numberOfLines={1}>{expenseCategoryLabel(e.category)}{e.supplierName ? ` · ${e.supplierName}` : ""}</Text>
                <View style={styles.row}>
                  <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(e.total)}</Text>
                  {e.paymentDate ? <Text style={[styles.meta, { color: c.mutedForeground }]}>· {fmtDate(e.paymentDate)}</Text> : null}
                </View>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 15 },
});
