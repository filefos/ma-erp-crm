import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListAssets } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { ASSET_STATUSES, assetConditionMeta, assetStatusMeta, fmtAed } from "@/lib/format";

export default function AssetsList() {
  const c = useColors();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const q = useListAssets();
  const data = useMemo(() => {
    const list = q.data ?? [];
    const t = search.trim().toLowerCase();
    return list.filter(a => {
      if (status && (a.status ?? "").toLowerCase() !== status) return false;
      if (!t) return true;
      return [a.name, a.assetId, a.category, a.assignedTo, a.currentLocation].filter(Boolean).some(v => String(v).toLowerCase().includes(t));
    });
  }, [q.data, status, search]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Asset register" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <BrandInput label="Search" icon="search" value={search} onChangeText={setSearch} />
        <Select label="Status" value={status} options={[{ value: "", label: "All statuses" }, ...ASSET_STATUSES.filter(s => s.value !== "in_use")]} onChange={setStatus} />
        <BrandButton label="New asset" icon="plus" onPress={() => router.push("/assets/list/new")} />

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="box" title="No assets" hint="Add your first tracked asset." /> : null}

        {data.map(a => {
          const sm = assetStatusMeta(a.status);
          const cm = assetConditionMeta(a.condition);
          return (
            <Pressable key={a.id} onPress={() => router.push({ pathname: "/assets/list/[id]", params: { id: String(a.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{a.name}</Text>
                  <StatusPill label={sm.label} tone={sm.tone} />
                </View>
                <Text style={[styles.meta, { color: c.mutedForeground }]}>{a.assetId}{a.category ? ` · ${a.category}` : ""}</Text>
                <View style={styles.row}>
                  {a.condition ? <StatusPill label={cm.label} tone={cm.tone} /> : null}
                  {a.currentLocation ? <Text style={[styles.meta, { color: c.mutedForeground }]}>· {a.currentLocation}</Text> : null}
                  {a.assignedTo ? <Text style={[styles.meta, { color: c.mutedForeground }]}>· {a.assignedTo}</Text> : null}
                </View>
                {Number(a.purchaseValue) > 0 ? <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(a.purchaseValue)}</Text> : null}
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
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 14, marginTop: 4 },
});
