import React from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useGetLeadsPipeline, type LeadsPipeline, type Lead } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { Card, EmptyState, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { fmtAed, leadScoreMeta } from "@/lib/format";

const SECTIONS: { key: keyof LeadsPipeline; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "siteVisit", label: "Site visit" },
  { key: "quotationRequired", label: "Quote required" },
  { key: "quotationSent", label: "Quote sent" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

export default function Pipeline() {
  const c = useColors();
  const router = useRouter();
  const q = useGetLeadsPipeline();
  const data = q.data;

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Lead pipeline" subtitle="Vertical kanban by status" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        {q.isLoading ? <LoadingBlock label="Loading pipeline…" /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {data ? SECTIONS.map(s => {
          const items: Lead[] = (data[s.key] ?? []) as Lead[];
          return (
            <View key={s.key} style={{ gap: 8 }}>
              <SectionHeading title={`${s.label} (${items.length})`} />
              {items.length === 0 ? <EmptyState icon="layers" title="Empty" /> : null}
              {items.map(l => {
                const score = leadScoreMeta(l.leadScore);
                return (
                  <Pressable key={l.id} onPress={() => router.push({ pathname: "/crm/leads/[id]", params: { id: String(l.id) } })}>
                    <Card>
                      <View style={styles.row}>
                        <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{l.leadName}</Text>
                        <StatusPill label={score.label} tone={score.tone} />
                      </View>
                      <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={1}>{l.companyName ?? l.contactPerson ?? l.leadNumber}</Text>
                      {l.budget ? <Text style={[styles.meta, { color: c.primary }]}>{fmtAed(l.budget)}</Text> : null}
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          );
        }) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 8, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
});
