import React, { useMemo, useState } from "react";
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetExpenseQueryKey, getListExpensesQueryKey,
  useDeleteExpense, useGetExpense, useUpdateExpense,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { ActionSheet, StatusPill } from "@/components/forms";
import { EXPENSE_STATUSES, expenseCategoryLabel, expenseStatusMeta, fmtAed, fmtDate, paymentMethodLabel } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

const RECEIPT_MARKER = "\n\n[Receipt]\n";

function splitDescription(d?: string): { text: string; receipt: string | null } {
  if (!d) return { text: "", receipt: null };
  const idx = d.indexOf(RECEIPT_MARKER);
  if (idx === -1) return { text: d, receipt: null };
  return { text: d.slice(0, idx), receipt: d.slice(idx + RECEIPT_MARKER.length) };
}

export default function ExpenseDetail() {
  const c = useColors();
  const qc = useQueryClient();
  const router = useRouter();
  const { activeCompanyId } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eid = Number(id);
  const q = useGetExpense(eid);
  const [statusOpen, setStatusOpen] = useState(false);

  const update = useUpdateExpense({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetExpenseQueryKey(eid) });
        qc.invalidateQueries({ queryKey: getListExpensesQueryKey() });
      },
      onError: (e: unknown) => Alert.alert("Update failed", (e as Error).message ?? ""),
    },
  });
  const del = useDeleteExpense({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListExpensesQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Delete failed", (e as Error).message ?? ""),
    },
  });

  const { text, receipt } = useMemo(() => splitDescription(q.data?.description), [q.data?.description]);

  if (q.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Expense" /><LoadingBlock /></View>;
  if (q.error || !q.data) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Expense" /><ErrorBlock message={(q.error as Error)?.message ?? "Not found"} onRetry={() => q.refetch()} /></View>;

  const e = q.data;
  const sm = expenseStatusMeta(e.status);

  const changeStatus = (status: string) => {
    update.mutate({
      id: eid,
      data: {
        category: e.category, supplierId: e.supplierId, invoiceNumber: e.invoiceNumber,
        amount: e.amount, vatAmount: e.vatAmount, total: e.total,
        paymentMethod: e.paymentMethod, paymentDate: e.paymentDate,
        companyId: e.companyId ?? activeCompanyId ?? 1,
        description: e.description, status,
      },
    });
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={e.expenseNumber} subtitle={expenseCategoryLabel(e.category)} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={sm.label} tone={sm.tone} />
            {e.paymentDate ? <Text style={[styles.meta, { color: c.mutedForeground }]}>{fmtDate(e.paymentDate)}</Text> : null}
          </View>
          {e.supplierName ? <Text style={[styles.body, { color: c.foreground }]}>Supplier: {e.supplierName}</Text> : null}
          {e.invoiceNumber ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Invoice: {e.invoiceNumber}</Text> : null}
          <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(e.total)}</Text>
          <Text style={[styles.meta, { color: c.mutedForeground }]}>Net {fmtAed(e.amount)} · VAT {fmtAed(e.vatAmount)} · {paymentMethodLabel(e.paymentMethod)}</Text>
        </Card>

        <View style={styles.row}>
          <BrandButton label="Status" icon="repeat" onPress={() => setStatusOpen(true)} style={{ flex: 1 }} />
          <BrandButton label="Delete" icon="trash-2" variant="ghost" onPress={() => Alert.alert("Delete expense", "This cannot be undone.", [
            { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => del.mutate({ id: eid }) },
          ])} style={{ flex: 1 }} />
        </View>

        {text ? <><SectionHeading title="Description" /><Card><Text style={[styles.body, { color: c.foreground }]}>{text}</Text></Card></> : null}

        {receipt ? (
          <>
            <SectionHeading title="Receipt" />
            <Card>
              <Image source={{ uri: receipt }} style={{ width: "100%", height: 320, borderRadius: 8 }} resizeMode="contain" />
            </Card>
          </>
        ) : null}
      </ScrollView>

      <ActionSheet
        visible={statusOpen} onClose={() => setStatusOpen(false)}
        title="Change status"
        actions={EXPENSE_STATUSES.map(s => ({ label: s.label, icon: "tag" as const, onPress: () => changeStatus(s.value) }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 22 },
});
