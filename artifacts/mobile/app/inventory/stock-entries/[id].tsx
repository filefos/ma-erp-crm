import React from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGetStockEntry } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { fmtDate, stockEntryTypeMeta } from "@/lib/format";

export default function StockEntryDetail() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eid = Number(id);
  const q = useGetStockEntry(eid);

  if (q.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Stock entry" /><LoadingBlock /></View>;
  if (q.error || !q.data) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Stock entry" /><ErrorBlock message={(q.error as Error)?.message ?? "Not found"} onRetry={() => q.refetch()} /></View>;

  const e = q.data;
  const tm = stockEntryTypeMeta(e.type);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={e.entryNumber} subtitle={tm.label} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={tm.label} tone={tm.tone} />
            {e.createdAt ? <Text style={[styles.meta, { color: c.mutedForeground }]}>{fmtDate(e.createdAt)}</Text> : null}
          </View>
          <Text style={[styles.amount, { color: c.primary }]}>{Number(e.quantity)} {e.unit}</Text>
          {e.itemId ? (
            <Pressable onPress={() => router.push({ pathname: "/inventory/items/[id]", params: { id: String(e.itemId) } })}>
              <Text style={[styles.body, { color: c.primary, marginTop: 6 }]}>{e.itemName ?? `Item #${e.itemId}`}</Text>
            </Pressable>
          ) : null}
          {e.createdByName ? <Text style={[styles.meta, { color: c.mutedForeground }]}>By {e.createdByName}</Text> : null}
        </Card>

        {e.reference ? <><SectionHeading title="Reference" /><Card><Text style={[styles.body, { color: c.foreground }]}>{e.reference}</Text></Card></> : null}
        {e.notes ? <><SectionHeading title="Notes" /><Card><Text style={[styles.body, { color: c.foreground }]}>{e.notes}</Text></Card></> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginVertical: 2 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 22, marginTop: 6 },
});
