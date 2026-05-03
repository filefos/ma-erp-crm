import React, { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListAssets } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { Card, KpiGrid, KpiTile, QuickLink, SectionHeading, Skeleton } from "@/components/ui";
import { fmtAed, fmtDate } from "@/lib/format";

const num = (v: unknown) => Number(v ?? 0) || 0;
const DAY = 24 * 60 * 60 * 1000;

export default function AssetsHub() {
  const c = useColors();
  const router = useRouter();
  const assets = useListAssets();
  const data = assets.data ?? [];

  const stats = useMemo(() => {
    const total = data.length;
    const value = data.reduce((s, a) => s + num(a.purchaseValue), 0);
    const byCondition = new Map<string, number>();
    const byLocation = new Map<string, number>();
    const now = Date.now();
    let maintDue = 0;
    let recent = 0;
    const recentList: typeof data = [];
    data.forEach(a => {
      const cond = (a.condition ?? "unknown").toLowerCase();
      byCondition.set(cond, (byCondition.get(cond) ?? 0) + 1);
      const loc = (a.currentLocation ?? "unassigned").trim() || "unassigned";
      byLocation.set(loc, (byLocation.get(loc) ?? 0) + 1);
      const md = a.maintenanceDate ? Date.parse(a.maintenanceDate) : NaN;
      if (!isNaN(md) && md - now <= 30 * DAY) maintDue += 1;
      const ca = a.createdAt ? Date.parse(a.createdAt) : NaN;
      if (!isNaN(ca) && now - ca <= 30 * DAY) { recent += 1; recentList.push(a); }
    });
    recentList.sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
    return { total, value, byCondition, byLocation, maintDue, recent, recentList: recentList.slice(0, 5) };
  }, [data]);

  const sortedConditions = Array.from(stats.byCondition.entries()).sort((a, b) => b[1] - a[1]);
  const sortedLocations = Array.from(stats.byLocation.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Assets" subtitle="Register · Condition · Maintenance" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={assets.isRefetching} onRefresh={() => assets.refetch()} tintColor={c.primary} />}
      >
        <SectionHeading title="Portfolio" />
        {assets.isLoading ? (
          <KpiGrid>
            <Skeleton height={84} /><Skeleton height={84} /><Skeleton height={84} /><Skeleton height={84} />
          </KpiGrid>
        ) : (
          <KpiGrid>
            <KpiTile label="Tracked" value={stats.total} icon="box" tone="navy" />
            <KpiTile label="Total value" value={fmtAed(stats.value)} icon="dollar-sign" tone="blue" />
            <KpiTile label="Maintenance due" value={stats.maintDue} icon="settings" tone={stats.maintDue ? "orange" : "muted"} hint="Next 30 days" />
            <KpiTile label="Recently added" value={stats.recent} icon="plus-circle" tone="blue" hint="Last 30 days" />
          </KpiGrid>
        )}

        <SectionHeading title="By condition" />
        <Card>
          {sortedConditions.length === 0 ? (
            <Text style={[styles.meta, { color: c.mutedForeground }]}>No assets yet.</Text>
          ) : sortedConditions.map(([k, n]) => (
            <View key={k} style={styles.statRow}>
              <Text style={[styles.body, { color: c.foreground, textTransform: "capitalize" }]}>{k.replace(/_/g, " ")}</Text>
              <Text style={[styles.body, { color: c.primary }]}>{n}</Text>
            </View>
          ))}
        </Card>

        <SectionHeading title="By location" />
        <Card>
          {sortedLocations.length === 0 ? (
            <Text style={[styles.meta, { color: c.mutedForeground }]}>No locations recorded.</Text>
          ) : sortedLocations.map(([k, n]) => (
            <View key={k} style={styles.statRow}>
              <Text style={[styles.body, { color: c.foreground }]} numberOfLines={1}>{k}</Text>
              <Text style={[styles.body, { color: c.primary }]}>{n}</Text>
            </View>
          ))}
        </Card>

        {stats.recentList.length > 0 ? (
          <>
            <SectionHeading title="Recently added" />
            {stats.recentList.map(a => (
              <Card key={a.id}>
                <Text style={[styles.body, { color: c.foreground }]}>{a.name}</Text>
                <Text style={[styles.meta, { color: c.mutedForeground }]}>{a.assetId} · {a.category}{a.createdAt ? ` · ${fmtDate(a.createdAt)}` : ""}</Text>
              </Card>
            ))}
          </>
        ) : null}

        <SectionHeading title="Manage" />
        <QuickLink icon="box" label="Asset register" hint={`${stats.total} assets`} onPress={() => router.push("/assets/list")} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
});
