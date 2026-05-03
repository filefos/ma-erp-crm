import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateChequeBody,
  getListChequesQueryKey,
  useCreateCheque,
  useListBankAccounts,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { CHEQUE_STATUSES } from "@/lib/format";
import { chequeAmountInWords } from "@/lib/number-to-words";
import { useApp } from "@/contexts/AppContext";

export default function NewCheque() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const banks = useListBankAccounts({ companyId: activeCompanyId ?? undefined });
  const [form, setForm] = useState<CreateChequeBody>({
    bankAccountId: 0,
    payeeName: "",
    amount: 0,
    chequeDate: new Date().toISOString().slice(0, 10),
    status: "draft",
    voucherReference: "",
    companyId: activeCompanyId ?? 1,
  });
  const upd = (p: Partial<CreateChequeBody>) => setForm(f => ({ ...f, ...p }));

  const words = useMemo(() => chequeAmountInWords(Number(form.amount) || 0), [form.amount]);
  const create = useCreateCheque({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListChequesQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.payeeName.trim()) return Alert.alert("Payee name is required");
    if (!form.bankAccountId) return Alert.alert("Bank account is required");
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) return Alert.alert("Amount must be greater than zero");
    create.mutate({ data: { ...form, amount: Number(form.amount), companyId: activeCompanyId ?? form.companyId } });
  };

  const bankOpts = (banks.data ?? []).map(b => ({ value: String(b.id), label: b.bankName, hint: b.accountNumber }));

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New cheque" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Select label="Bank account *" value={String(form.bankAccountId || "")} options={bankOpts} onChange={v => upd({ bankAccountId: Number(v) || 0 })} />
        <BrandInput label="Payee (in favor of) *" icon="user" value={form.payeeName} onChangeText={v => upd({ payeeName: v })} />
        <FormRow>
          <FormCell><BrandInput label="Amount (AED) *" keyboardType="numeric" value={String(form.amount ?? 0)} onChangeText={v => upd({ amount: Number(v) || 0 })} /></FormCell>
          <FormCell><BrandInput label="Cheque date *" value={form.chequeDate} onChangeText={v => upd({ chequeDate: v })} /></FormCell>
        </FormRow>
        <Card>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Amount in words</Text>
          <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{words}</Text>
        </Card>
        <BrandInput label="Voucher reference / memo" value={form.voucherReference ?? ""} onChangeText={v => upd({ voucherReference: v })} />
        <Select label="Status" value={form.status ?? "draft"} options={CHEQUE_STATUSES} onChange={v => upd({ status: v })} />
        <BrandButton label="Create cheque" icon="check" loading={create.isPending} onPress={submit} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
