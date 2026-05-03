import React, { useMemo, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  type PaymentMade,
  getListPaymentsMadeQueryKey,
  useDeletePaymentMade, useListBankAccounts, useListPaymentsMade, useUpdatePaymentMade,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { PAYMENT_METHODS, fmtAed, fmtDate, paymentMethodLabel } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

export default function PaymentsMadeList() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const q = useListPaymentsMade({ companyId: activeCompanyId ?? undefined });
  const data = useMemo(
    () => (q.data ?? []).filter(p => activeCompanyId == null || p.companyId === activeCompanyId),
    [q.data, activeCompanyId],
  );
  const del = useDeletePaymentMade({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListPaymentsMadeQueryKey() }),
      onError: (e: unknown) => Alert.alert("Delete failed", (e as Error).message ?? ""),
    },
  });
  const [editing, setEditing] = useState<PaymentMade | null>(null);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Payments made" subtitle={`${data.length} payment${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <BrandButton label="New payment" icon="plus" onPress={() => router.push("/accounts/payments-made/new")} />

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="upload" title="No payments yet" hint="Record payments to suppliers." /> : null}

        {data.map(p => (
          <Card key={p.id}>
            <View style={styles.row}>
              <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{p.paymentNumber}</Text>
              <Pressable hitSlop={8} onPress={() => setEditing(p)}>
                <Feather name="edit-2" size={16} color={c.primary} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => Alert.alert("Delete payment", "Cannot be undone.", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => del.mutate({ id: p.id }) },
              ])}>
                <Feather name="trash-2" size={16} color={c.destructive} />
              </Pressable>
            </View>
            <Text style={[styles.body, { color: c.foreground }]} numberOfLines={1}>{p.payeeName}</Text>
            {p.expenseRef ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Expense: {p.expenseRef}</Text> : null}
            <View style={styles.row}>
              <Text style={[styles.amount, { color: c.accent }]}>{fmtAed(p.amount)}</Text>
              <Text style={[styles.meta, { color: c.mutedForeground }]}>· {paymentMethodLabel(p.paymentMethod)} · {fmtDate(p.paymentDate)}</Text>
            </View>
            {p.notes ? <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={2}>{p.notes}</Text> : null}
          </Card>
        ))}
      </ScrollView>

      <EditPaymentModal visible={!!editing} payment={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

function EditPaymentModal({ visible, payment, onClose }: { visible: boolean; payment: PaymentMade | null; onClose: () => void }) {
  const c = useColors();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const banks = useListBankAccounts({ companyId: activeCompanyId ?? undefined });
  const update = useUpdatePaymentMade({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListPaymentsMadeQueryKey() }); onClose(); },
      onError: (e: unknown) => Alert.alert("Update failed", (e as Error).message ?? ""),
    },
  });
  const [form, setForm] = useState({
    payeeName: "", expenseRef: "", paymentDate: "", amount: 0, paymentMethod: "bank_transfer",
    bankAccountId: "", referenceNumber: "", notes: "", status: "paid",
  });
  React.useEffect(() => {
    if (payment) setForm({
      payeeName: payment.payeeName, expenseRef: payment.expenseRef ?? "",
      paymentDate: payment.paymentDate, amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      bankAccountId: payment.bankAccountId != null ? String(payment.bankAccountId) : "",
      referenceNumber: payment.referenceNumber ?? "", notes: payment.notes ?? "",
      status: payment.status ?? "paid",
    });
  }, [payment]);
  const upd = (p: Partial<typeof form>) => setForm(f => ({ ...f, ...p }));
  if (!payment) return null;
  const bankOpts = [{ value: "", label: "None" }, ...(banks.data ?? []).map(b => ({ value: String(b.id), label: b.bankName, hint: b.accountNumber }))];
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="formSheet">
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <AppHeader title="Edit payment" subtitle={payment.paymentNumber} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BrandInput label="Payee name" value={form.payeeName} onChangeText={v => upd({ payeeName: v })} />
          <BrandInput label="Expense reference" value={form.expenseRef} onChangeText={v => upd({ expenseRef: v })} />
          <FormRow>
            <FormCell><BrandInput label="Amount (AED)" keyboardType="numeric" value={String(form.amount)} onChangeText={v => upd({ amount: Number(v) || 0 })} /></FormCell>
            <FormCell><BrandInput label="Date" value={form.paymentDate} onChangeText={v => upd({ paymentDate: v })} /></FormCell>
          </FormRow>
          <Select label="Method" value={form.paymentMethod} options={PAYMENT_METHODS} onChange={v => upd({ paymentMethod: v })} />
          <Select label="Bank account" value={form.bankAccountId} options={bankOpts} onChange={v => upd({ bankAccountId: v })} />
          <BrandInput label="Reference #" value={form.referenceNumber} onChangeText={v => upd({ referenceNumber: v })} />
          <BrandInput label="Notes" multiline value={form.notes} onChangeText={v => upd({ notes: v })} style={{ minHeight: 60, textAlignVertical: "top" }} />
          <View style={styles.row}>
            <BrandButton label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <BrandButton label="Save" loading={update.isPending} onPress={() => update.mutate({
              id: payment.id,
              data: {
                companyId: payment.companyId,
                payeeName: form.payeeName, expenseRef: form.expenseRef,
                paymentDate: form.paymentDate, amount: Number(form.amount),
                paymentMethod: form.paymentMethod,
                bankAccountId: form.bankAccountId ? Number(form.bankAccountId) : undefined,
                referenceNumber: form.referenceNumber, notes: form.notes, status: form.status,
              },
            })} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </View>
    </Modal>
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
