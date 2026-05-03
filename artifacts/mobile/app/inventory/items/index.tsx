import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListInventoryItems } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { fmtAed } from "@/lib/format";

const num = (v: unknown) => Number(v ?? 0) || 0;

export default function ItemsList() {
  const c = useColors();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const q = useListInventoryItems();
  const data = useMemo(() => {
    const list = q.data ?? [];
    const t = search.trim().toLowerCase();
    return list.filter(i => {
      if (filter === "low" && !(num(i.currentStock) <= num(i.minimumStock) && num(i.minimumStock) > 0)) return false;
      if (filter === "out" && num(i.currentStock) > 0) return false;
      if (!t) return true;
      return [i.name, i.itemCode, i.category, i.warehouseLocation].filter(Boolean).some(v => String(v).toLowerCase().includes(t));
    });
  }, [q.data, search, filter]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Items" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <BrandInput label="Search" icon="search" value={search} onChangeText={setSearch} />
        <Select label="Filter" value={filter} options={[
          { value: "", label: "All items" },
          { value: "low", label: "Low stock" },
          { value: "out", label: "Out of stock" },
        ]} onChange={setFilter} />
        <View style={styles.row}>
          <BrandButton label="New item" icon="plus" onPress={() => router.push("/inventory/items/new")} style={{ flex: 1 }} />
          <BrandButton label="Scan" variant="secondary" icon="camera" onPress={() => router.push("/inventory/scan")} style={{ flex: 1 }} />
        </View>

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="package" title="No items" hint="Add inventory items to track stock." /> : null}

        {data.map(i => {
          const low = num(i.currentStock) <= num(i.minimumStock) && num(i.minimumStock) > 0;
          const out = num(i.currentStock) <= 0;
          return (
            <Pressable key={i.id} onPress={() => router.push({ pathname: "/inventory/items/[id]", params: { id: String(i.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{i.name}</Text>
                  {out ? <StatusPill label="Out" tone="destructive" /> : low ? <StatusPill label="Low" tone="orange" /> : <StatusPill label="OK" tone="success" />}
                </View>
                <View style={styles.row}>
                  <Text style={[styles.meta, { color: c.mutedForeground }]}>{i.itemCode}</Text>
                  {i.category ? <Text style={[styles.meta, { color: c.mutedForeground }]}>· {i.category}</Text> : null}
                  {i.warehouseLocation ? <Text style={[styles.meta, { color: c.mutedForeground }]}>· {i.warehouseLocation}</Text> : null}
                </View>
                <View style={styles.row}>
                  <Text style={[styles.body, { color: c.foreground }]}>{num(i.currentStock)} {i.unit}</Text>
                  {num(i.unitCost) > 0 ? <Text style={[styles.meta, { color: c.primary }]}>· {fmtAed(num(i.currentStock) * num(i.unitCost))}</Text> : null}
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
