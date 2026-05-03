import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useListBankAccounts, useListCheques } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { CHEQUE_STATUSES, chequeStatusMeta, fmtAed, fmtDate } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

export default function ChequesList() {
  const c = useColors();
  const router = useRouter();
  const { activeCompanyId, activeCompany } = useApp();
  const [status, setStatus] = useState("");
  const q = useListCheques({ companyId: activeCompanyId ?? undefined, ...(status ? { status } : {}) });
  const banks = useListBankAccounts({ companyId: activeCompanyId ?? undefined });
  const data = useMemo(
    () => (q.data ?? []).filter(i => activeCompanyId == null || i.companyId === activeCompanyId || i.companyId == null),
    [q.data, activeCompanyId],
  );
  const bankName = (id: number) => banks.data?.find(b => b.id === id)?.bankName;

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Cheques" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        {activeCompany ? (
          <View style={[styles.banner, { backgroundColor: c.accent }]}>
            <Feather name="alert-circle" size={16} color="#fff" />
            <Text style={styles.bannerText} numberOfLines={2}>
              All cheques shall be prepared in favor of "{activeCompany.name.toUpperCase()}"
            </Text>
          </View>
        ) : null}

        <Select label="Status" value={status} options={[{ value: "", label: "All statuses" }, ...CHEQUE_STATUSES]} onChange={setStatus} />
        <BrandButton label="New cheque" icon="plus" onPress={() => router.push("/accounts/cheques/new")} />

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="credit-card" title="No cheques" hint="Issue your first cheque." /> : null}

        {data.map(ch => {
          const sm = chequeStatusMeta(ch.status);
          return (
            <Pressable key={ch.id} onPress={() => router.push({ pathname: "/accounts/cheques/[id]", params: { id: String(ch.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>#{ch.chequeNumber}</Text>
                  <StatusPill label={sm.label} tone={sm.tone} />
                </View>
                <Text style={[styles.body, { color: c.foreground }]} numberOfLines={1}>To: {ch.payeeName}</Text>
                <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={1}>{ch.bankName ?? bankName(ch.bankAccountId) ?? "Bank"} · {fmtDate(ch.chequeDate)}</Text>
                <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(ch.amount)}</Text>
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
  banner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12 },
  bannerText: { flex: 1, color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 15 },
});
