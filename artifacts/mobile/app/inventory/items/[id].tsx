import React from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGetInventoryItem, useListStockEntries } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { fmtAed, fmtDate, stockEntryTypeMeta } from "@/lib/format";

const num = (v: unknown) => Number(v ?? 0) || 0;

export default function ItemDetail() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const iid = Number(id);
  const q = useGetInventoryItem(iid);
  const entries = useListStockEntries({ itemId: iid });

  if (q.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Item" /><LoadingBlock /></View>;
  if (q.error || !q.data) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Item" /><ErrorBlock message={(q.error as Error)?.message ?? "Not found"} onRetry={() => q.refetch()} /></View>;

  const i = q.data;
  const stock = num(i.currentStock);
  const min = num(i.minimumStock);
  const low = stock <= min && min > 0;
  const out = stock <= 0;
  const list = entries.data ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={i.name} subtitle={i.itemCode} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); entries.refetch(); }} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            {out ? <StatusPill label="Out of stock" tone="destructive" /> : low ? <StatusPill label="Low stock" tone="orange" /> : <StatusPill label="In stock" tone="success" />}
            {i.category ? <Text style={[styles.meta, { color: c.mutedForeground }]}>{i.category}</Text> : null}
          </View>
          <Text style={[styles.amount, { color: c.primary }]}>{stock} {i.unit}</Text>
          <Text style={[styles.meta, { color: c.mutedForeground }]}>Min {min} {i.unit}{i.warehouseLocation ? ` · ${i.warehouseLocation}` : ""}</Text>
          {num(i.unitCost) > 0 ? <Text style={[styles.body, { color: c.foreground, marginTop: 6 }]}>Stock value: {fmtAed(stock * num(i.unitCost))}</Text> : null}
        </Card>

        <View style={styles.row}>
          <BrandButton label="Stock in" icon="arrow-down-circle"
            onPress={() => router.push({ pathname: "/inventory/stock-entries/new", params: { itemId: String(iid), type: "stock_in" } })} style={{ flex: 1 }} />
          <BrandButton label="Stock out" variant="secondary" icon="arrow-up-circle"
            onPress={() => router.push({ pathname: "/inventory/stock-entries/new", params: { itemId: String(iid), type: "stock_out" } })} style={{ flex: 1 }} />
        </View>
        <BrandButton label="Edit item" variant="ghost" icon="edit-3"
          onPress={() => router.push({ pathname: "/inventory/items/[id]/edit", params: { id: String(iid) } })} />

        <SectionHeading title={`Recent movements (${list.length})`} />
        {entries.isLoading ? <LoadingBlock /> : null}
        {!entries.isLoading && list.length === 0 ? <Card><Text style={{ color: c.mutedForeground }}>No stock movements yet.</Text></Card> : null}
        {list.map(e => {
          const tm = stockEntryTypeMeta(e.type);
          return (
            <Pressable key={e.id} onPress={() => router.push({ pathname: "/inventory/stock-entries/[id]", params: { id: String(e.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{e.entryNumber}</Text>
                  <StatusPill label={tm.label} tone={tm.tone} />
                </View>
                <View style={styles.row}>
                  <Text style={[styles.body, { color: c.foreground }]}>{Number(e.quantity)} {e.unit}</Text>
                  {e.createdAt ? <Text style={[styles.meta, { color: c.mutedForeground }]}>· {fmtDate(e.createdAt)}</Text> : null}
                </View>
                {e.reference ? <Text style={[styles.meta, { color: c.mutedForeground }]}>{e.reference}</Text> : null}
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
  amount: { fontFamily: "Inter_700Bold", fontSize: 22, marginTop: 6 },
});
