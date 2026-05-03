import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListJournalEntries } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { JE_STATUSES, fmtAed, fmtDate, jeStatusMeta } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

export default function JournalEntriesList() {
  const c = useColors();
  const router = useRouter();
  const { activeCompanyId } = useApp();
  const [status, setStatus] = useState("");
  const q = useListJournalEntries({ companyId: activeCompanyId ?? undefined, ...(status ? { status } : {}) });
  const data = useMemo(
    () => (q.data ?? []).filter(j => activeCompanyId == null || j.companyId === activeCompanyId),
    [q.data, activeCompanyId],
  );

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Journal entries" subtitle={`${data.length} entr${data.length === 1 ? "y" : "ies"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Select label="Status" value={status} options={[{ value: "", label: "All statuses" }, ...JE_STATUSES]} onChange={setStatus} />
        <BrandButton label="New journal entry" icon="plus" onPress={() => router.push("/accounts/journal-entries/new")} />

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="book" title="No journal entries" hint="Create your first journal entry." /> : null}

        {data.map(j => {
          const sm = jeStatusMeta(j.status);
          return (
            <Pressable key={j.id} onPress={() => router.push({ pathname: "/accounts/journal-entries/[id]", params: { id: String(j.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{j.journalNumber}</Text>
                  <StatusPill label={sm.label} tone={sm.tone} />
                </View>
                <Text style={[styles.body, { color: c.foreground }]} numberOfLines={2}>{j.description}</Text>
                <View style={styles.row}>
                  <Text style={[styles.amount, { color: c.primary }]}>Dr {fmtAed(j.totalDebit)}</Text>
                  <Text style={[styles.meta, { color: c.mutedForeground }]}>· Cr {fmtAed(j.totalCredit)}</Text>
                  <Text style={[styles.meta, { color: c.mutedForeground }]}>· {fmtDate(j.entryDate)}</Text>
                </View>
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
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  body: { fontFamily: "Inter_500Medium", fontSize: 13 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 14 },
});
