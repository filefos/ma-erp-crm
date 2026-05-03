import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListCompanies } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandInput, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { StatusPill } from "@/components/forms";

export default function CompaniesList() {
  const c = useColors();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const q = useListCompanies();
  const data = q.data ?? [];

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data;
    return data.filter(d =>
      [d.name, d.shortName, d.prefix, d.email, d.trn].some(v => (v ?? "").toLowerCase().includes(s)),
    );
  }, [data, search]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Companies" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <BrandInput label="Search" icon="search" placeholder="Name, prefix, TRN…" value={search} onChangeText={setSearch} />

        {q.isLoading ? <LoadingBlock label="Loading companies…" /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? "Unknown error"} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && filtered.length === 0 ? (
          <EmptyState icon="briefcase" title="No companies" hint={search ? "Try a different search." : "No companies are registered."} />
        ) : null}

        {filtered.map(co => (
          <Pressable key={co.id} onPress={() => router.push({ pathname: "/admin/companies/[id]" as never, params: { id: String(co.id) } } as never)}>
            <Card>
              <View style={styles.row}>
                <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{co.name}</Text>
                <StatusPill label={co.isActive ? "Active" : "Inactive"} tone={co.isActive ? "success" : "muted"} />
              </View>
              <Text style={[styles.sub, { color: c.mutedForeground }]} numberOfLines={1}>
                {co.shortName} · {co.prefix}{co.trn ? ` · TRN ${co.trn}` : ""}
              </Text>
              {co.email || co.phone ? (
                <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={1}>
                  {[co.email, co.phone].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
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
