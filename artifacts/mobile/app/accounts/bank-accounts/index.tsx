import React, { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useListBankAccounts } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { useApp } from "@/contexts/AppContext";

export default function BankAccountsList() {
  const c = useColors();
  const router = useRouter();
  const { activeCompanyId, activeCompany } = useApp();
  const q = useListBankAccounts({ companyId: activeCompanyId ?? undefined });
  const data = useMemo(
    () => (q.data ?? []).filter(b => activeCompanyId == null || b.companyId === activeCompanyId),
    [q.data, activeCompanyId],
  );

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Bank accounts" subtitle={`${data.length} account${data.length === 1 ? "" : "s"}`} />
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
        <BrandButton label="New bank account" icon="plus" onPress={() => router.push("/accounts/bank-accounts/new")} />

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="briefcase" title="No bank accounts" hint="Add your first bank account." /> : null}

        {data.map(b => (
          <Pressable key={b.id} onPress={() => router.push({ pathname: "/accounts/bank-accounts/[id]", params: { id: String(b.id) } })}>
            <Card>
              <Text style={[styles.title, { color: c.foreground }]}>{b.bankName}</Text>
              <Text style={[styles.body, { color: c.foreground }]}>{b.accountName}</Text>
              <Text style={[styles.meta, { color: c.mutedForeground }]}>A/C: {b.accountNumber}</Text>
              {b.iban ? <Text style={[styles.meta, { color: c.mutedForeground }]}>IBAN: {b.iban}</Text> : null}
              <Text style={[styles.meta, { color: b.isActive ? c.success : c.destructive }]}>{b.isActive ? "Active" : "Inactive"}</Text>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12 },
  bannerText: { flex: 1, color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
});
