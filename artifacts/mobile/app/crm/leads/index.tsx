import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useListLeads } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { LEAD_STATUSES, leadScoreMeta, leadStatusMeta, fmtRelative } from "@/lib/format";

export default function LeadsList() {
  const c = useColors();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const params = { ...(status ? { status } : {}), ...(search.trim() ? { search: search.trim() } : {}) };
  const q = useListLeads(params);
  const data = q.data ?? [];
  const filtered = useMemo(() => data, [data]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Leads" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <BrandInput label="Search" icon="search" placeholder="Lead name, company, contact…" value={search} onChangeText={setSearch} />
        <Select label="Status" value={status} options={[{ value: "", label: "All statuses" }, ...LEAD_STATUSES]} onChange={setStatus} />
        <BrandButton label="New lead" icon="plus" onPress={() => router.push("/crm/leads/new")} />

        {q.isLoading ? <LoadingBlock label="Loading leads…" /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? "Unknown error"} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && filtered.length === 0 ? (
          <EmptyState icon="users" title="No leads" hint="Create your first lead to get started." />
        ) : null}

        {filtered.map(l => {
          const sm = leadStatusMeta(l.status);
          const score = leadScoreMeta(l.leadScore);
          return (
            <Pressable key={l.id} onPress={() => router.push({ pathname: "/crm/leads/[id]", params: { id: String(l.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{l.leadName}</Text>
                  <StatusPill label={score.label} tone={score.tone} />
                </View>
                <View style={styles.row}>
                  <Text style={[styles.sub, { color: c.mutedForeground, flex: 1 }]} numberOfLines={1}>
                    {l.contactPerson ?? l.companyName ?? l.leadNumber}
                  </Text>
                  <StatusPill label={sm.label} tone={sm.tone} />
                </View>
                <View style={styles.row}>
                  <Text style={[styles.meta, { color: c.mutedForeground }]}>{l.assignedToName ?? "Unassigned"}</Text>
                  <Feather name="clock" size={12} color={c.mutedForeground} />
                  <Text style={[styles.meta, { color: c.mutedForeground }]}>{fmtRelative(l.nextFollowUp)}</Text>
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
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  sub: { fontFamily: "Inter_500Medium", fontSize: 13 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
});
