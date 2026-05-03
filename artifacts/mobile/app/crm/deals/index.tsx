import React, { useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateDealBody, type Deal,
  getListDealsQueryKey,
  useDeleteDeal, useListDeals, useUpdateDeal,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, EmptyState, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { ActionSheet, Select, StatusPill } from "@/components/forms";
import { DEAL_STAGES, dealStageMeta, fmtAed, fmtDate } from "@/lib/format";

type Mode = "list" | "kanban";

export default function DealsList() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const [stage, setStage] = useState<string>("");
  const [mode, setMode] = useState<Mode>("list");
  const params = stage ? { stage } : undefined;
  const q = useListDeals(params);
  const [target, setTarget] = useState<Deal | null>(null);

  const update = useUpdateDeal({
    mutation: {
      onMutate: async (vars) => {
        await qc.cancelQueries({ queryKey: getListDealsQueryKey() });
        const prevList = qc.getQueryData<Deal[] | undefined>(getListDealsQueryKey(params));
        const prevAll = qc.getQueryData<Deal[] | undefined>(getListDealsQueryKey());
        const apply = (old: Deal[] | undefined) => (old ?? []).map(d => d.id === vars.id ? { ...d, ...vars.data } : d);
        qc.setQueryData<Deal[] | undefined>(getListDealsQueryKey(params), apply);
        qc.setQueryData<Deal[] | undefined>(getListDealsQueryKey(), apply);
        return { prevList, prevAll };
      },
      onError: (_e, _v, ctx) => {
        if (ctx?.prevList) qc.setQueryData(getListDealsQueryKey(params), ctx.prevList);
        if (ctx?.prevAll) qc.setQueryData(getListDealsQueryKey(), ctx.prevAll);
        Alert.alert("Update failed");
      },
      onSettled: () => qc.invalidateQueries({ queryKey: getListDealsQueryKey() }),
    },
  });
  const del = useDeleteDeal({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListDealsQueryKey() }),
      onError: (e: unknown) => Alert.alert("Delete failed", (e as Error).message ?? ""),
    },
  });

  const data = q.data ?? [];
  const grouped = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const s of DEAL_STAGES) map.set(s.value, []);
    for (const d of data) {
      const k = (d.stage ?? "new").toLowerCase();
      map.get(k)?.push(d) ?? map.set(k, [d]);
    }
    return map;
  }, [data]);

  const stageBody = (d: Deal): CreateDealBody => ({
    title: d.title, clientName: d.clientName, value: d.value, probability: d.probability,
    expectedCloseDate: d.expectedCloseDate, assignedToId: d.assignedToId, companyId: d.companyId,
    leadId: d.leadId, notes: d.notes, stage: d.stage,
  });

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Deals" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <View style={styles.toggleRow}>
          <Pressable onPress={() => setMode("list")} style={[styles.toggleBtn, { backgroundColor: mode === "list" ? c.primary : c.secondary }]}>
            <Feather name="list" size={14} color={mode === "list" ? "#ffffff" : c.primary} />
            <Text style={[styles.toggleLbl, { color: mode === "list" ? "#ffffff" : c.primary }]}>List</Text>
          </Pressable>
          <Pressable onPress={() => setMode("kanban")} style={[styles.toggleBtn, { backgroundColor: mode === "kanban" ? c.primary : c.secondary }]}>
            <Feather name="trello" size={14} color={mode === "kanban" ? "#ffffff" : c.primary} />
            <Text style={[styles.toggleLbl, { color: mode === "kanban" ? "#ffffff" : c.primary }]}>Kanban</Text>
          </Pressable>
        </View>
        {mode === "list" ? (
          <Select label="Stage" value={stage} options={[{ value: "", label: "All stages" }, ...DEAL_STAGES]} onChange={setStage} />
        ) : null}
        <BrandButton label="New deal" icon="plus" onPress={() => router.push("/crm/deals/new")} />

        {q.isLoading ? <LoadingBlock label="Loading deals…" /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="briefcase" title="No deals" hint="Create your first deal to start tracking." /> : null}

        {mode === "list" ? data.map(d => {
          const sm = dealStageMeta(d.stage);
          return (
            <Pressable key={d.id} onPress={() => router.push({ pathname: "/crm/deals/[id]", params: { id: String(d.id) } })} onLongPress={() => setTarget(d)}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{d.title}</Text>
                  <StatusPill label={sm.label} tone={sm.tone} />
                </View>
                <Text style={[styles.sub, { color: c.mutedForeground }]} numberOfLines={1}>{d.clientName ?? d.dealNumber}</Text>
                <View style={styles.row}>
                  <Text style={[styles.body, { color: c.primary }]}>{fmtAed(d.value)}</Text>
                  <Text style={[styles.meta, { color: c.mutedForeground }]}>· {d.probability ?? 0}% · close {fmtDate(d.expectedCloseDate)}</Text>
                </View>
              </Card>
            </Pressable>
          );
        }) : (
          DEAL_STAGES.map(s => {
            const list = grouped.get(s.value) ?? [];
            return (
              <View key={s.value} style={{ gap: 8 }}>
                <SectionHeading title={`${s.label} (${list.length})`} />
                {list.length === 0 ? <EmptyState icon="layers" title="Empty" /> : null}
                {list.map(d => (
                  <Pressable key={d.id} onPress={() => router.push({ pathname: "/crm/deals/[id]", params: { id: String(d.id) } })} onLongPress={() => setTarget(d)}>
                    <Card>
                      <View style={styles.row}>
                        <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{d.title}</Text>
                        <StatusPill label={`${d.probability ?? 0}%`} tone="navy" />
                      </View>
                      <Text style={[styles.sub, { color: c.mutedForeground }]} numberOfLines={1}>{d.clientName ?? d.dealNumber}</Text>
                      <Text style={[styles.body, { color: c.primary }]}>{fmtAed(d.value)}</Text>
                    </Card>
                  </Pressable>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      <ActionSheet
        visible={!!target}
        onClose={() => setTarget(null)}
        title={target?.title ?? "Deal"}
        actions={[
          ...DEAL_STAGES.map(s => ({
            label: `Move to ${s.label}`, icon: "trending-up" as const,
            onPress: () => target && update.mutate({ id: target.id, data: { ...stageBody(target), stage: s.value } }),
          })),
          { label: "Edit", icon: "edit-2" as const, onPress: () => target && router.push({ pathname: "/crm/deals/[id]/edit", params: { id: String(target.id) } }) },
          { label: "Delete", icon: "trash-2" as const, destructive: true,
            onPress: () => target && Alert.alert("Delete deal?", target.title, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => del.mutate({ id: target.id }) },
            ]) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  sub: { fontFamily: "Inter_500Medium", fontSize: 13 },
  body: { fontFamily: "Inter_700Bold", fontSize: 15 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  toggleLbl: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
