import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListStockEntries } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { STOCK_ENTRY_TYPES, fmtDate, stockEntryTypeMeta } from "@/lib/format";

export default function StockEntriesList() {
  const c = useColors();
  const router = useRouter();
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const q = useListStockEntries(type ? { type } : undefined);
  const data = useMemo(() => {
    const list = q.data ?? [];
    const t = search.trim().toLowerCase();
    if (!t) return list;
    return list.filter(e => [e.entryNumber, e.itemName, e.reference, e.createdByName].filter(Boolean).some(v => String(v).toLowerCase().includes(t)));
  }, [q.data, search]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Stock movements" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <BrandInput label="Search" icon="search" value={search} onChangeText={setSearch} />
        <Select label="Type" value={type} options={[{ value: "", label: "All types" }, ...STOCK_ENTRY_TYPES]} onChange={setType} />
        <View style={styles.row}>
          <BrandButton label="New entry" icon="plus" onPress={() => router.push("/inventory/stock-entries/new")} style={{ flex: 1 }} />
          <BrandButton label="Scan" variant="secondary" icon="camera" onPress={() => router.push("/inventory/scan")} style={{ flex: 1 }} />
        </View>

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="repeat" title="No stock movements" hint="Record stock in/out for any item." /> : null}

        {data.map(e => {
          const tm = stockEntryTypeMeta(e.type);
          return (
            <Pressable key={e.id} onPress={() => router.push({ pathname: "/inventory/stock-entries/[id]", params: { id: String(e.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{e.entryNumber}</Text>
                  <StatusPill label={tm.label} tone={tm.tone} />
                </View>
                <Text style={[styles.body, { color: c.foreground }]} numberOfLines={1}>{e.itemName ?? `Item #${e.itemId}`}</Text>
                <View style={styles.row}>
                  <Text style={[styles.body, { color: c.foreground }]}>{Number(e.quantity)} {e.unit}</Text>
                  {e.createdAt ? <Text style={[styles.meta, { color: c.mutedForeground }]}>· {fmtDate(e.createdAt)}</Text> : null}
                  {e.createdByName ? <Text style={[styles.meta, { color: c.mutedForeground }]}>· {e.createdByName}</Text> : null}
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
