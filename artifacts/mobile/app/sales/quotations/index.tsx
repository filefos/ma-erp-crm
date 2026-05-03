import React, { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListQuotations } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { QUOTATION_STATUSES, fmtAed, fmtDate, quotationStatusMeta } from "@/lib/format";

export default function QuotationsList() {
  const c = useColors();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const params = { ...(status ? { status } : {}), ...(search.trim() ? { search: search.trim() } : {}) };
  const q = useListQuotations(params);
  const data = q.data ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Quotations" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <BrandInput label="Search" icon="search" placeholder="Number, client, project…" value={search} onChangeText={setSearch} />
        <Select label="Status" value={status} options={[{ value: "", label: "All statuses" }, ...QUOTATION_STATUSES]} onChange={setStatus} />
        <BrandButton label="New quotation" icon="plus" onPress={() => router.push("/sales/quotations/new")} />

        {q.isLoading ? <LoadingBlock label="Loading quotations…" /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="file-text" title="No quotations" hint="Create one to send your first quote." /> : null}

        {data.map(qt => {
          const sm = quotationStatusMeta(qt.status);
          return (
            <Pressable key={qt.id} onPress={() => router.push({ pathname: "/sales/quotations/[id]", params: { id: String(qt.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{qt.quotationNumber}</Text>
                  <StatusPill label={sm.label} tone={sm.tone} />
                </View>
                <Text style={[styles.sub, { color: c.foreground }]} numberOfLines={1}>{qt.clientName}</Text>
                {qt.projectName ? <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={1}>{qt.projectName}</Text> : null}
                <View style={styles.row}>
                  <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(qt.grandTotal)}</Text>
                  <Text style={[styles.meta, { color: c.mutedForeground }]}>· {fmtDate(qt.createdAt)}</Text>
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
  sub: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 15 },
});
