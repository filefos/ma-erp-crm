import React, { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useListLeads } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { Card, EmptyState, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { fmtAed } from "@/lib/format";

interface Row { name: string; won: number; open: number; budget: number }

export default function Leaderboard() {
  const c = useColors();
  const q = useListLeads();
  const rows: Row[] = useMemo(() => {
    const map = new Map<string, Row>();
    for (const l of q.data ?? []) {
      const name = l.assignedToName ?? "Unassigned";
      const r = map.get(name) ?? { name, won: 0, open: 0, budget: 0 };
      const status = (l.status ?? "").toLowerCase();
      if (status === "won") r.won += 1;
      else if (status !== "lost") r.open += 1;
      r.budget += Number(l.budget ?? 0);
      map.set(name, r);
    }
    return [...map.values()].sort((a, b) => b.won - a.won || b.budget - a.budget);
  }, [q.data]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Sales leaderboard" subtitle="Won leads by owner" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && rows.length === 0 ? <EmptyState icon="award" title="No data yet" hint="Once leads are owned and won, the board will populate." /> : null}

        <SectionHeading title="Top performers" />
        {rows.map((r, i) => (
          <Card key={r.name}>
            <View style={styles.row}>
              <View style={[styles.rank, { backgroundColor: i < 3 ? c.accent : c.muted }]}>
                <Text style={[styles.rankText, { color: i < 3 ? "#ffffff" : c.foreground }]}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>{r.name}</Text>
                <Text style={[styles.meta, { color: c.mutedForeground }]}>Open {r.open} · {fmtAed(r.budget)} pipeline</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.value, { color: c.primary }]}>{r.won}</Text>
                <Text style={[styles.meta, { color: c.mutedForeground }]}>wins</Text>
              </View>
              {i === 0 && r.won > 0 ? <Feather name="award" size={20} color={c.accent} /> : null}
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rank: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  rankText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  name: { fontFamily: "Inter_700Bold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  value: { fontFamily: "Inter_700Bold", fontSize: 20 },
});
