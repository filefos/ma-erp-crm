import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreatePaymentMadeBody,
  getListPaymentsMadeQueryKey,
  useCreatePaymentMade,
  useListBankAccounts,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { PAYMENT_METHODS } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

export default function NewPaymentMade() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const banks = useListBankAccounts({ companyId: activeCompanyId ?? undefined });
  const [form, setForm] = useState<CreatePaymentMadeBody>({
    companyId: activeCompanyId ?? 1,
    payeeName: "", expenseRef: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: 0, paymentMethod: "bank_transfer",
    referenceNumber: "", notes: "", status: "paid",
  });
  const upd = (p: Partial<CreatePaymentMadeBody>) => setForm(f => ({ ...f, ...p }));

  const create = useCreatePaymentMade({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListPaymentsMadeQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.payeeName.trim()) return Alert.alert("Payee name is required");
    if (Number(form.amount) <= 0) return Alert.alert("Amount must be greater than zero");
    create.mutate({ data: { ...form, companyId: activeCompanyId ?? form.companyId, amount: Number(form.amount) } });
  };

  const bankOpts = [{ value: "", label: "None" }, ...(banks.data ?? []).map(b => ({ value: String(b.id), label: b.bankName, hint: b.accountNumber }))];

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New payment made" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BrandInput label="Payee name *" icon="user" value={form.payeeName} onChangeText={v => upd({ payeeName: v })} />
        <BrandInput label="Expense reference" value={form.expenseRef ?? ""} onChangeText={v => upd({ expenseRef: v })} />
        <FormRow>
          <FormCell><BrandInput label="Amount (AED) *" keyboardType="numeric" value={String(form.amount ?? 0)} onChangeText={v => upd({ amount: Number(v) || 0 })} /></FormCell>
          <FormCell><BrandInput label="Date *" value={form.paymentDate} onChangeText={v => upd({ paymentDate: v })} /></FormCell>
        </FormRow>
        <Select label="Method *" value={form.paymentMethod} options={PAYMENT_METHODS} onChange={v => upd({ paymentMethod: v })} />
        <Select label="Bank account" value={form.bankAccountId ? String(form.bankAccountId) : ""} options={bankOpts} onChange={v => upd({ bankAccountId: v ? Number(v) : undefined })} />
        <BrandInput label="Reference #" value={form.referenceNumber ?? ""} onChangeText={v => upd({ referenceNumber: v })} />
        <BrandInput label="Notes" multiline value={form.notes ?? ""} onChangeText={v => upd({ notes: v })} style={{ minHeight: 60, textAlignVertical: "top" }} />
        <BrandButton label="Record payment" icon="check" loading={create.isPending} onPress={submit} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
