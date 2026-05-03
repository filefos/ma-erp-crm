import React, { useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetChequeQueryKey, getListChequesQueryKey,
  useGetCheque, useListBankAccounts, useUpdateCheque,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { ActionSheet, FormCell, FormRow, Select, StatusPill } from "@/components/forms";
import { CHEQUE_STATUSES, chequeStatusMeta, fmtAed, fmtDate } from "@/lib/format";
import { chequeAmountInWords } from "@/lib/number-to-words";
import { useApp } from "@/contexts/AppContext";

export default function ChequeDetail() {
  const c = useColors();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cid = Number(id);
  const q = useGetCheque(cid);
  const { activeCompanyId } = useApp();
  const banks = useListBankAccounts({ companyId: activeCompanyId ?? undefined });
  const [statusOpen, setStatusOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const update = useUpdateCheque({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetChequeQueryKey(cid) });
        qc.invalidateQueries({ queryKey: getListChequesQueryKey() });
      },
      onError: (e: unknown) => Alert.alert("Update failed", (e as Error).message ?? ""),
    },
  });

  if (q.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Cheque" /><LoadingBlock /></View>;
  if (q.error || !q.data) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Cheque" /><ErrorBlock message={(q.error as Error)?.message ?? "Not found"} onRetry={() => q.refetch()} /></View>;

  const ch = q.data;
  const sm = chequeStatusMeta(ch.status);

  const changeStatus = (status: string) => {
    update.mutate({
      id: cid,
      data: {
        bankAccountId: ch.bankAccountId, payeeName: ch.payeeName, amount: ch.amount,
        chequeDate: ch.chequeDate, supplierId: ch.supplierId, projectId: ch.projectId,
        voucherReference: ch.voucherReference, companyId: ch.companyId ?? activeCompanyId ?? 1,
        status,
      },
    });
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={`#${ch.chequeNumber}`} subtitle={ch.payeeName} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={sm.label} tone={sm.tone} />
            <Text style={[styles.meta, { color: c.mutedForeground }]}>Dated {fmtDate(ch.chequeDate)}</Text>
          </View>
          <Text style={[styles.body, { color: c.foreground }]} numberOfLines={1}>Bank: {ch.bankName ?? "—"}</Text>
          <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(ch.amount)}</Text>
          <Text style={[styles.meta, { color: c.mutedForeground }]}>{ch.amountInWords ?? chequeAmountInWords(Number(ch.amount) || 0)}</Text>
          {ch.voucherReference ? <Text style={[styles.body, { color: c.foreground }]}>Ref: {ch.voucherReference}</Text> : null}
        </Card>

        <View style={styles.row}>
          <BrandButton label="Status" icon="repeat" onPress={() => setStatusOpen(true)} style={{ flex: 1 }} />
          <BrandButton label="Edit" icon="edit-2" variant="secondary" onPress={() => setEditing(true)} style={{ flex: 1 }} />
        </View>

        {editing ? (
          <EditCard cheque={ch} banks={banks.data ?? []} loading={update.isPending}
            onCancel={() => setEditing(false)}
            onSave={(data) => update.mutate({ id: cid, data }, { onSuccess: () => setEditing(false) })} />
        ) : null}

        <SectionHeading title="Trail" />
        <Card>
          <Text style={[styles.meta, { color: c.mutedForeground }]}>Created {fmtDate(ch.createdAt)}</Text>
          {ch.printedAt ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Printed {fmtDate(ch.printedAt)}</Text> : null}
        </Card>
      </ScrollView>

      <ActionSheet
        visible={statusOpen} onClose={() => setStatusOpen(false)}
        title="Change status"
        actions={CHEQUE_STATUSES.map(s => ({ label: s.label, icon: "tag" as const, onPress: () => changeStatus(s.value) }))}
      />
    </View>
  );
}

function EditCard({ cheque, banks, loading, onCancel, onSave }: {
  cheque: { id: number; companyId?: number; bankAccountId: number; payeeName: string; amount: number; chequeDate: string; supplierId?: number; projectId?: number; voucherReference?: string; status: string };
  banks: { id: number; bankName: string; accountNumber: string }[];
  loading: boolean;
  onCancel: () => void;
  onSave: (d: { bankAccountId: number; payeeName: string; amount: number; chequeDate: string; voucherReference?: string; companyId: number; status: string }) => void;
}) {
  const c = useColors();
  const { activeCompanyId } = useApp();
  const [form, setForm] = useState({
    bankAccountId: cheque.bankAccountId,
    payeeName: cheque.payeeName,
    amount: cheque.amount,
    chequeDate: cheque.chequeDate,
    voucherReference: cheque.voucherReference ?? "",
    status: cheque.status,
  });
  const upd = (p: Partial<typeof form>) => setForm(f => ({ ...f, ...p }));
  const words = useMemo(() => chequeAmountInWords(Number(form.amount) || 0), [form.amount]);
  const bankOpts = banks.map(b => ({ value: String(b.id), label: b.bankName, hint: b.accountNumber }));

  return (
    <Card>
      <Select label="Bank account" value={String(form.bankAccountId)} options={bankOpts} onChange={v => upd({ bankAccountId: Number(v) || 0 })} />
      <BrandInput label="Payee" value={form.payeeName} onChangeText={v => upd({ payeeName: v })} />
      <FormRow>
        <FormCell><BrandInput label="Amount" keyboardType="numeric" value={String(form.amount)} onChangeText={v => upd({ amount: Number(v) || 0 })} /></FormCell>
        <FormCell><BrandInput label="Cheque date" value={form.chequeDate} onChangeText={v => upd({ chequeDate: v })} /></FormCell>
      </FormRow>
      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>{words}</Text>
      <BrandInput label="Voucher reference" value={form.voucherReference} onChangeText={v => upd({ voucherReference: v })} />
      <Select label="Status" value={form.status} options={CHEQUE_STATUSES} onChange={v => upd({ status: v })} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <BrandButton label="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <BrandButton label="Save" loading={loading} onPress={() => onSave({ ...form, companyId: cheque.companyId ?? activeCompanyId ?? 1 })} style={{ flex: 1 }} />
      </View>
    </Card>
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
