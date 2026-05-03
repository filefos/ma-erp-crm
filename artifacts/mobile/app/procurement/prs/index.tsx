import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListPurchaseRequests } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { PR_STATUSES, fmtDate, prPriorityMeta, prStatusMeta } from "@/lib/format";

export default function PrsList() {
  const c = useColors();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const q = useListPurchaseRequests(status ? { status } : undefined);
  const data = useMemo(() => {
    const list = q.data ?? [];
    const t = search.trim().toLowerCase();
    if (!t) return list;
    return list.filter(p => [p.prNumber, p.description, p.department, p.projectRef, p.requestedByName].filter(Boolean).some(v => String(v).toLowerCase().includes(t)));
  }, [q.data, search]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Purchase requests" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <BrandInput label="Search" icon="search" value={search} onChangeText={setSearch} />
        <Select label="Status" value={status} options={[{ value: "", label: "All statuses" }, ...PR_STATUSES]} onChange={setStatus} />
        <BrandButton label="New PR" icon="plus" onPress={() => router.push("/procurement/prs/new")} />

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="clipboard" title="No purchase requests" hint="Raise a PR to start the procurement flow." /> : null}

        {data.map(p => {
          const sm = prStatusMeta(p.status);
          const pm = prPriorityMeta(p.priority);
          return (
            <Pressable key={p.id} onPress={() => router.push({ pathname: "/procurement/prs/[id]", params: { id: String(p.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{p.prNumber}</Text>
                  <StatusPill label={sm.label} tone={sm.tone} />
                </View>
                <Text style={[styles.body, { color: c.foreground }]} numberOfLines={2}>{p.description}</Text>
                <View style={styles.row}>
                  {p.priority ? <StatusPill label={pm.label} tone={pm.tone} /> : null}
                  {p.department ? <Text style={[styles.meta, { color: c.mutedForeground }]}>· {p.department}</Text> : null}
                  {p.requiredDate ? <Text style={[styles.meta, { color: c.mutedForeground }]}>· need {fmtDate(p.requiredDate)}</Text> : null}
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
