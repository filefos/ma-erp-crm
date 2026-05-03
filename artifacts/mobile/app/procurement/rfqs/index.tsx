import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListRfqs } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { RFQ_STATUSES, fmtDate, rfqStatusMeta } from "@/lib/format";

export default function RfqsList() {
  const c = useColors();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const q = useListRfqs(status ? { status } : undefined);
  const data = useMemo(() => {
    const list = q.data ?? [];
    const t = search.trim().toLowerCase();
    if (!t) return list;
    return list.filter(r => [r.rfqNumber, r.prNumber, r.notes].filter(Boolean).some(v => String(v).toLowerCase().includes(t)));
  }, [q.data, search]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="RFQs" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <BrandInput label="Search" icon="search" value={search} onChangeText={setSearch} />
        <Select label="Status" value={status} options={[{ value: "", label: "All statuses" }, ...RFQ_STATUSES]} onChange={setStatus} />
        <BrandButton label="New RFQ" icon="plus" onPress={() => router.push("/procurement/rfqs/new")} />

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="send" title="No RFQs" hint="Send a request to multiple suppliers." /> : null}

        {data.map(r => {
          const sm = rfqStatusMeta(r.status);
          const supplierCount = (r.suppliers ?? r.supplierIds ?? []).length;
          return (
            <Pressable key={r.id} onPress={() => router.push({ pathname: "/procurement/rfqs/[id]", params: { id: String(r.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{r.rfqNumber}</Text>
                  <StatusPill label={sm.label} tone={sm.tone} />
                </View>
                {r.prNumber ? <Text style={[styles.body, { color: c.foreground }]}>From {r.prNumber}</Text> : null}
                <View style={styles.row}>
                  <Text style={[styles.meta, { color: c.mutedForeground }]}>{supplierCount} supplier{supplierCount === 1 ? "" : "s"}</Text>
                  {r.requiredDeliveryDate ? <Text style={[styles.meta, { color: c.mutedForeground }]}>· need {fmtDate(r.requiredDeliveryDate)}</Text> : null}
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
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
});
