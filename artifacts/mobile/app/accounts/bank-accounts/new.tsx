import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateBankAccountBody,
  getListBankAccountsQueryKey,
  useCreateBankAccount,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput } from "@/components/ui";
import { FormCell, FormRow } from "@/components/forms";
import { useApp } from "@/contexts/AppContext";

export default function NewBankAccount() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const [form, setForm] = useState<CreateBankAccountBody>({
    bankName: "", accountName: "", accountNumber: "", iban: "", swiftCode: "", currency: "AED",
    companyId: activeCompanyId ?? 1,
  });
  const upd = (p: Partial<CreateBankAccountBody>) => setForm(f => ({ ...f, ...p }));

  const create = useCreateBankAccount({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListBankAccountsQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.bankName.trim() || !form.accountName.trim() || !form.accountNumber.trim()) {
      return Alert.alert("Bank, account name and account number are required");
    }
    create.mutate({ data: { ...form, companyId: activeCompanyId ?? form.companyId } });
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New bank account" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BrandInput label="Bank name *" value={form.bankName} onChangeText={v => upd({ bankName: v })} />
        <BrandInput label="Account name *" value={form.accountName} onChangeText={v => upd({ accountName: v })} />
        <BrandInput label="Account number *" value={form.accountNumber} onChangeText={v => upd({ accountNumber: v })} />
        <FormRow>
          <FormCell><BrandInput label="IBAN" value={form.iban ?? ""} onChangeText={v => upd({ iban: v })} /></FormCell>
          <FormCell><BrandInput label="SWIFT" value={form.swiftCode ?? ""} onChangeText={v => upd({ swiftCode: v })} /></FormCell>
        </FormRow>
        <BrandInput label="Currency" value={form.currency ?? "AED"} onChangeText={v => upd({ currency: v })} />
        <BrandButton label="Create" icon="check" loading={create.isPending} onPress={submit} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
