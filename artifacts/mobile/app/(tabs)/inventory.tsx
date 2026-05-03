import React, { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListInventoryItems, useListStockEntries } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { Card, KpiGrid, KpiTile, QuickLink, SectionHeading, Skeleton } from "@/components/ui";
import { fmtAed, fmtDate } from "@/lib/format";

const num = (v: unknown) => Number(v ?? 0) || 0;
const DAY = 24 * 60 * 60 * 1000;

export default function InventoryHub() {
  const c = useColors();
  const router = useRouter();
  const items = useListInventoryItems();
  const entries = useListStockEntries();

  const refetchAll = () => { items.refetch(); entries.refetch(); };
  const loading = items.isLoading || entries.isLoading;
  const refreshing = items.isRefetching || entries.isRefetching;

  const stats = useMemo(() => {
    const list = items.data ?? [];
    const moves = entries.data ?? [];
    const total = list.length;
    const lowStock = list.filter(i => num(i.currentStock) <= num(i.minimumStock) && num(i.minimumStock) > 0).length;
    const outOfStock = list.filter(i => num(i.currentStock) <= 0).length;
    const stockValue = list.reduce((s, i) => s + num(i.currentStock) * num(i.unitCost), 0);
    const now = Date.now();
    const recentMoves = moves.filter(m => {
      const d = m.createdAt ? Date.parse(m.createdAt) : NaN;
      return !isNaN(d) && now - d <= 7 * DAY;
    });
    const recent = [...moves]
      .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""))
      .slice(0, 5);
    return { total, lowStock, outOfStock, stockValue, recentMoves: recentMoves.length, recent };
  }, [items.data, entries.data]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Inventory" subtitle="Items · Stock movements" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} tintColor={c.primary} />}
      >
        <SectionHeading title="Stock overview" />
        {loading ? (
          <KpiGrid>
            <Skeleton height={84} /><Skeleton height={84} /><Skeleton height={84} /><Skeleton height={84} />
          </KpiGrid>
        ) : (
          <KpiGrid>
            <KpiTile label="Items tracked" value={stats.total} icon="package" tone="navy" />
            <KpiTile label="Low stock" value={stats.lowStock} icon="alert-triangle" tone={stats.lowStock ? "orange" : "muted"} />
            <KpiTile label="Out of stock" value={stats.outOfStock} icon="x-octagon" tone={stats.outOfStock ? "orange" : "muted"} />
            <KpiTile label="Stock value" value={fmtAed(stats.stockValue)} icon="dollar-sign" tone="blue" />
            <KpiTile label="Recent movements" value={stats.recentMoves} icon="repeat" tone="navy" hint="Last 7 days" />
          </KpiGrid>
        )}

        {stats.recent.length > 0 ? (
          <>
            <SectionHeading title="Latest movements" />
            {stats.recent.map(m => {
              const isOut = (m.type ?? "").toLowerCase().includes("out");
              return (
                <Pressable key={m.id} onPress={() => router.push({ pathname: "/inventory/stock-entries/[id]", params: { id: String(m.id) } })}>
                  <Card>
                    <View style={styles.rowBetween}>
                      <Text style={[styles.body, { color: c.foreground }]} numberOfLines={1}>{m.itemName ?? `Item #${m.itemId}`}</Text>
                      <Text style={[styles.body, { color: isOut ? c.destructive : c.success }]}>{isOut ? "−" : "+"}{Number(m.quantity)} {m.unit ?? ""}</Text>
                    </View>
                    <Text style={[styles.meta, { color: c.mutedForeground }]}>
                      {(m.type ?? "").replace(/_/g, " ")}{m.createdAt ? ` · ${fmtDate(m.createdAt)}` : ""}{m.reference ? ` · ${m.reference}` : ""}
                    </Text>
                  </Card>
                </Pressable>
              );
            })}
          </>
        ) : null}

        <SectionHeading title="Manage" />
        <QuickLink icon="package" label="Items" hint={`${stats.total} tracked`} onPress={() => router.push("/inventory/items")} />
        <QuickLink icon="repeat" label="Stock movements" hint={`${(entries.data ?? []).length} entries`} onPress={() => router.push("/inventory/stock-entries")} />
        <QuickLink icon="camera" label="Scan barcode" onPress={() => router.push("/inventory/scan")} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
});
