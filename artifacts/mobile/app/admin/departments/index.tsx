import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListDepartments } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandInput, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { fmtDate } from "@/lib/format";

export default function DepartmentsList() {
  const c = useColors();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const q = useListDepartments();
  const data = q.data ?? [];

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data;
    return data.filter(d => [d.name, d.description].some(v => (v ?? "").toLowerCase().includes(s)));
  }, [data, search]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Departments" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <BrandInput label="Search" icon="search" placeholder="Department name…" value={search} onChangeText={setSearch} />

        {q.isLoading ? <LoadingBlock label="Loading departments…" /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? "Unknown error"} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && filtered.length === 0 ? (
          <EmptyState icon="grid" title="No departments" hint={search ? "Try a different search." : "No departments are configured."} />
        ) : null}

        {filtered.map(d => (
          <Pressable key={d.id} onPress={() => router.push({ pathname: "/admin/departments/[id]" as never, params: { id: String(d.id) } } as never)}>
            <Card>
              <View style={styles.row}>
                <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{d.name}</Text>
                <StatusPill label={d.isActive ? "Active" : "Inactive"} tone={d.isActive ? "success" : "muted"} />
              </View>
              {d.description ? <Text style={[styles.sub, { color: c.mutedForeground }]} numberOfLines={2}>{d.description}</Text> : null}
              <Text style={[styles.meta, { color: c.mutedForeground }]}>Created {fmtDate(d.createdAt)}</Text>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  sub: { fontFamily: "Inter_500Medium", fontSize: 13 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
});
