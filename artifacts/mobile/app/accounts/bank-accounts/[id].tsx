import React, { useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListBankAccountsQueryKey,
  useListBankAccounts, useUpdateBankAccount,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { useApp } from "@/contexts/AppContext";

export default function BankAccountDetail() {
  const c = useColors();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bid = Number(id);
  const { activeCompanyId } = useApp();
  const q = useListBankAccounts({ companyId: activeCompanyId ?? undefined });
  const account = useMemo(() => (q.data ?? []).find(b => b.id === bid), [q.data, bid]);
  const [editing, setEditing] = useState(false);

  const update = useUpdateBankAccount({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListBankAccountsQueryKey() }); setEditing(false); },
      onError: (e: unknown) => Alert.alert("Update failed", (e as Error).message ?? ""),
    },
  });

  if (q.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Bank account" /><LoadingBlock /></View>;
  if (!account) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Bank account" /><ErrorBlock message="Not found" onRetry={() => q.refetch()} /></View>;

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={account.bankName} subtitle={account.accountName} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <Text style={[styles.body, { color: c.foreground }]}>A/C: {account.accountNumber}</Text>
          {account.iban ? <Text style={[styles.body, { color: c.foreground }]}>IBAN: {account.iban}</Text> : null}
          {account.swiftCode ? <Text style={[styles.body, { color: c.foreground }]}>SWIFT: {account.swiftCode}</Text> : null}
          <Text style={[styles.meta, { color: c.mutedForeground }]}>Currency: {account.currency ?? "AED"}</Text>
          <Text style={[styles.meta, { color: account.isActive ? c.success : c.destructive }]}>{account.isActive ? "Active" : "Inactive"}</Text>
        </Card>

        <BrandButton label={editing ? "Cancel edit" : "Edit"} icon="edit-2" variant={editing ? "ghost" : "secondary"} onPress={() => setEditing(e => !e)} />

        {editing ? (
          <EditForm account={account} loading={update.isPending}
            onSave={(data) => update.mutate({ id: bid, data })} />
        ) : (
          <SectionHeading title="" />
        )}
      </ScrollView>
    </View>
  );
}

function EditForm({ account, loading, onSave }: {
  account: { bankName: string; accountName: string; accountNumber: string; iban?: string; swiftCode?: string; currency?: string; companyId: number; isActive: boolean };
  loading: boolean;
  onSave: (d: { bankName: string; accountName: string; accountNumber: string; iban?: string; swiftCode?: string; currency?: string; companyId: number }) => void;
}) {
  const [form, setForm] = useState({
    bankName: account.bankName, accountName: account.accountName, accountNumber: account.accountNumber,
    iban: account.iban ?? "", swiftCode: account.swiftCode ?? "", currency: account.currency ?? "AED",
    isActive: account.isActive ? "true" : "false",
  });
  const upd = (p: Partial<typeof form>) => setForm(f => ({ ...f, ...p }));
  return (
    <Card>
      <BrandInput label="Bank name" value={form.bankName} onChangeText={v => upd({ bankName: v })} />
      <BrandInput label="Account name" value={form.accountName} onChangeText={v => upd({ accountName: v })} />
      <BrandInput label="Account number" value={form.accountNumber} onChangeText={v => upd({ accountNumber: v })} />
      <FormRow>
        <FormCell><BrandInput label="IBAN" value={form.iban} onChangeText={v => upd({ iban: v })} /></FormCell>
        <FormCell><BrandInput label="SWIFT" value={form.swiftCode} onChangeText={v => upd({ swiftCode: v })} /></FormCell>
      </FormRow>
      <BrandInput label="Currency" value={form.currency} onChangeText={v => upd({ currency: v })} />
      <Select label="Status" value={form.isActive} options={[{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }]} onChange={v => upd({ isActive: v })} />
      <BrandButton label="Save" loading={loading} onPress={() => onSave({
        bankName: form.bankName, accountName: form.accountName, accountNumber: form.accountNumber,
        iban: form.iban || undefined, swiftCode: form.swiftCode || undefined, currency: form.currency,
        companyId: account.companyId,
      })} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
});
