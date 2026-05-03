import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateChartOfAccountBody,
  getListChartOfAccountsQueryKey,
  useCreateChartOfAccount,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { ACCOUNT_TYPES } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

export default function NewChartOfAccount() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { activeCompanyId } = useApp();
  const [form, setForm] = useState<CreateChartOfAccountBody>({
    companyId: activeCompanyId ?? 1,
    accountCode: "", accountName: "", accountType: "asset",
    openingBalance: 0, currency: "AED", description: "", isActive: true,
  });
  const upd = (p: Partial<CreateChartOfAccountBody>) => setForm(f => ({ ...f, ...p }));

  const create = useCreateChartOfAccount({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListChartOfAccountsQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Could not save", (e as Error).message ?? ""),
    },
  });

  const submit = () => {
    if (!form.accountCode.trim() || !form.accountName.trim()) return Alert.alert("Code and name are required");
    create.mutate({ data: { ...form, companyId: activeCompanyId ?? form.companyId, openingBalance: Number(form.openingBalance) || 0 } });
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New account" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormRow>
          <FormCell><BrandInput label="Code *" value={form.accountCode} onChangeText={v => upd({ accountCode: v })} /></FormCell>
          <FormCell><Select label="Type *" value={form.accountType} options={ACCOUNT_TYPES} onChange={v => upd({ accountType: v })} /></FormCell>
        </FormRow>
        <BrandInput label="Name *" value={form.accountName} onChangeText={v => upd({ accountName: v })} />
        <FormRow>
          <FormCell><BrandInput label="Opening balance" keyboardType="numeric" value={String(form.openingBalance ?? 0)} onChangeText={v => upd({ openingBalance: Number(v) || 0 })} /></FormCell>
          <FormCell><BrandInput label="Currency" value={form.currency ?? "AED"} onChangeText={v => upd({ currency: v })} /></FormCell>
        </FormRow>
        <BrandInput label="Description" multiline value={form.description ?? ""} onChangeText={v => upd({ description: v })} style={{ minHeight: 60, textAlignVertical: "top" }} />
        <BrandButton label="Create account" icon="check" loading={create.isPending} onPress={submit} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
