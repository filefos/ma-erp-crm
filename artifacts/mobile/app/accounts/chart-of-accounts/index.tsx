import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListChartOfAccounts } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, EmptyState, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { Select } from "@/components/forms";
import { ACCOUNT_TYPES, accountTypeLabel, fmtAed } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

export default function ChartOfAccountsList() {
  const c = useColors();
  const router = useRouter();
  const { activeCompanyId } = useApp();
  const [type, setType] = useState("");
  const q = useListChartOfAccounts({ companyId: activeCompanyId ?? undefined, ...(type ? { accountType: type } : {}) });
  const data = useMemo(
    () => (q.data ?? []).filter(a => activeCompanyId == null || a.companyId === activeCompanyId),
    [q.data, activeCompanyId],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, typeof data>();
    for (const a of data) {
      const t = a.accountType.toLowerCase();
      if (!m.has(t)) m.set(t, []);
      m.get(t)!.push(a);
    }
    return [...m.entries()].sort();
  }, [data]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Chart of accounts" subtitle={`${data.length} account${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Select label="Account type" value={type} options={[{ value: "", label: "All types" }, ...ACCOUNT_TYPES]} onChange={setType} />
        <BrandButton label="New account" icon="plus" onPress={() => router.push("/accounts/chart-of-accounts/new")} />

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="list" title="No accounts" hint="Create your chart of accounts." /> : null}

        {grouped.map(([t, items]) => (
          <View key={t} style={{ gap: 8 }}>
            <SectionHeading title={accountTypeLabel(t)} />
            {items.map(a => (
              <Pressable key={a.id} onPress={() => router.push({ pathname: "/accounts/chart-of-accounts/[id]", params: { id: String(a.id) } })}>
                <Card>
                  <View style={styles.row}>
                    <Text style={[styles.code, { color: c.primary }]}>{a.accountCode}</Text>
                    <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{a.accountName}</Text>
                    <Text style={[styles.amount, { color: c.foreground }]}>{fmtAed(a.currentBalance ?? a.openingBalance ?? 0)}</Text>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  code: { fontFamily: "Inter_700Bold", fontSize: 13, minWidth: 56 },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 13 },
});
