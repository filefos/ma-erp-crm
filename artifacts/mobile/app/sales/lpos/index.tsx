import React, { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListLpos } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { LPO_STATUSES, fmtAed, fmtDate, lpoStatusMeta } from "@/lib/format";

export default function LposList() {
  const c = useColors();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const params = status ? { status } : undefined;
  const q = useListLpos(params);
  const data = q.data ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="LPOs" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Select label="Status" value={status} options={[{ value: "", label: "All statuses" }, ...LPO_STATUSES]} onChange={setStatus} />
        <BrandButton label="New LPO" icon="plus" onPress={() => router.push("/sales/lpos/new")} />

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="check-square" title="No LPOs" hint="Record your first Local Purchase Order." /> : null}

        {data.map(l => {
          const sm = lpoStatusMeta(l.status);
          return (
            <Pressable key={l.id} onPress={() => router.push({ pathname: "/sales/lpos/[id]", params: { id: String(l.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{l.lpoNumber}</Text>
                  <StatusPill label={sm.label} tone={sm.tone} />
                </View>
                <Text style={[styles.body, { color: c.foreground }]} numberOfLines={1}>{l.clientName}</Text>
                {l.projectRef ? <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={1}>Ref: {l.projectRef}</Text> : null}
                <View style={styles.row}>
                  <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(l.lpoValue)}</Text>
                  {l.lpoDate ? <Text style={[styles.meta, { color: c.mutedForeground }]}>· {fmtDate(l.lpoDate)}</Text> : null}
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
  amount: { fontFamily: "Inter_700Bold", fontSize: 15 },
});
