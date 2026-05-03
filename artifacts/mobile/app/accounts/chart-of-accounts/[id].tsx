import React, { useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListChartOfAccountsQueryKey,
  useDeleteChartOfAccount, useListChartOfAccounts, useUpdateChartOfAccount,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { ACCOUNT_TYPES, accountTypeLabel, fmtAed } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

export default function ChartOfAccountDetail() {
  const c = useColors();
  const qc = useQueryClient();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const aid = Number(id);
  const { activeCompanyId } = useApp();
  const q = useListChartOfAccounts({ companyId: activeCompanyId ?? undefined });
  const account = useMemo(() => (q.data ?? []).find(a => a.id === aid), [q.data, aid]);
  const [editing, setEditing] = useState(false);

  const update = useUpdateChartOfAccount({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListChartOfAccountsQueryKey() }); setEditing(false); },
      onError: (e: unknown) => Alert.alert("Update failed", (e as Error).message ?? ""),
    },
  });
  const del = useDeleteChartOfAccount({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListChartOfAccountsQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Delete failed", (e as Error).message ?? ""),
    },
  });

  if (q.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Account" /><LoadingBlock /></View>;
  if (!account) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Account" /><ErrorBlock message="Not found" onRetry={() => q.refetch()} /></View>;

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={`${account.accountCode} · ${account.accountName}`} subtitle={accountTypeLabel(account.accountType)} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <Text style={[styles.body, { color: c.foreground }]}>Opening balance: {fmtAed(account.openingBalance ?? 0)}</Text>
          <Text style={[styles.body, { color: c.foreground }]}>Current balance: {fmtAed(account.currentBalance ?? 0)}</Text>
          <Text style={[styles.meta, { color: c.mutedForeground }]}>Currency: {account.currency ?? "AED"}</Text>
          {account.description ? <Text style={[styles.meta, { color: c.mutedForeground }]}>{account.description}</Text> : null}
          <Text style={[styles.meta, { color: account.isActive ? c.success : c.destructive }]}>{account.isActive ? "Active" : "Inactive"}</Text>
        </Card>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <BrandButton label={editing ? "Cancel" : "Edit"} icon={editing ? "x" : "edit-2"} variant="secondary" onPress={() => setEditing(e => !e)} style={{ flex: 1 }} />
          <BrandButton label="Delete" icon="trash-2" variant="ghost" onPress={() => Alert.alert("Delete account", "Cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => del.mutate({ id: aid }) },
          ])} style={{ flex: 1 }} />
        </View>

        {editing ? (
          <EditForm account={account} loading={update.isPending}
            onSave={(data) => update.mutate({ id: aid, data })} />
        ) : <SectionHeading title="" />}
      </ScrollView>
    </View>
  );
}

function EditForm({ account, loading, onSave }: {
  account: { accountCode: string; accountName: string; accountType: string; openingBalance?: number; currency?: string; description?: string; isActive: boolean; companyId: number };
  loading: boolean;
  onSave: (d: { companyId: number; accountCode: string; accountName: string; accountType: string; openingBalance?: number; currency?: string; description?: string; isActive?: boolean }) => void;
}) {
  const [form, setForm] = useState({
    accountCode: account.accountCode, accountName: account.accountName, accountType: account.accountType,
    openingBalance: account.openingBalance ?? 0, currency: account.currency ?? "AED",
    description: account.description ?? "", isActive: account.isActive ? "true" : "false",
  });
  const upd = (p: Partial<typeof form>) => setForm(f => ({ ...f, ...p }));
  return (
    <Card>
      <FormRow>
        <FormCell><BrandInput label="Code" value={form.accountCode} onChangeText={v => upd({ accountCode: v })} /></FormCell>
        <FormCell><Select label="Type" value={form.accountType} options={ACCOUNT_TYPES} onChange={v => upd({ accountType: v })} /></FormCell>
      </FormRow>
      <BrandInput label="Name" value={form.accountName} onChangeText={v => upd({ accountName: v })} />
      <FormRow>
        <FormCell><BrandInput label="Opening balance" keyboardType="numeric" value={String(form.openingBalance)} onChangeText={v => upd({ openingBalance: Number(v) || 0 })} /></FormCell>
        <FormCell><BrandInput label="Currency" value={form.currency} onChangeText={v => upd({ currency: v })} /></FormCell>
      </FormRow>
      <BrandInput label="Description" multiline value={form.description} onChangeText={v => upd({ description: v })} style={{ minHeight: 60, textAlignVertical: "top" }} />
      <Select label="Status" value={form.isActive} options={[{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }]} onChange={v => upd({ isActive: v })} />
      <BrandButton label="Save" loading={loading} onPress={() => onSave({
        companyId: account.companyId, accountCode: form.accountCode, accountName: form.accountName,
        accountType: form.accountType, openingBalance: Number(form.openingBalance) || 0,
        currency: form.currency, description: form.description, isActive: form.isActive === "true",
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
