import React, { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  type CreateDealBody, type Deal,
  getListDealsQueryKey,
  useDeleteDeal, useListActivities, useListDeals, useUpdateDeal,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, EmptyState, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { ActionSheet, StatusPill } from "@/components/forms";
import { DEAL_STAGES, activityTypeIcon, activityTypeLabel, dealStageMeta, fmtAed, fmtDate, fmtRelative } from "@/lib/format";

export default function DealDetail() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const did = Number(id);
  const list = useListDeals();
  const d: Deal | null = (list.data ?? []).find(x => x.id === did) ?? null;
  const acts = useListActivities({ dealId: did });
  const [stageOpen, setStageOpen] = useState(false);

  const update = useUpdateDeal({
    mutation: {
      onMutate: async (vars) => {
        await qc.cancelQueries({ queryKey: getListDealsQueryKey() });
        const prev = qc.getQueryData<Deal[] | undefined>(getListDealsQueryKey());
        qc.setQueryData<Deal[] | undefined>(getListDealsQueryKey(), old => (old ?? []).map(x => x.id === vars.id ? { ...x, ...vars.data } : x));
        return { prev };
      },
      onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(getListDealsQueryKey(), ctx.prev); Alert.alert("Update failed"); },
      onSettled: () => qc.invalidateQueries({ queryKey: getListDealsQueryKey() }),
    },
  });
  const del = useDeleteDeal({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListDealsQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Delete failed", (e as Error).message ?? ""),
    },
  });

  if (list.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Deal" /><LoadingBlock /></View>;
  if (list.error) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Deal" /><ErrorBlock message={(list.error as Error).message ?? ""} onRetry={() => list.refetch()} /></View>;
  if (!d) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Deal" /><ErrorBlock message="Deal not found" onRetry={() => list.refetch()} /></View>;

  const sm = dealStageMeta(d.stage);
  const body: CreateDealBody = {
    title: d.title, clientName: d.clientName, value: d.value, probability: d.probability,
    expectedCloseDate: d.expectedCloseDate, assignedToId: d.assignedToId, companyId: d.companyId,
    leadId: d.leadId, notes: d.notes, stage: d.stage,
  };

  const onDelete = () => Alert.alert("Delete deal?", d.title, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => del.mutate({ id: did }) },
  ]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={d.title} subtitle={d.dealNumber} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={list.isRefetching || acts.isRefetching} onRefresh={() => { list.refetch(); acts.refetch(); }} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={sm.label} tone={sm.tone} />
            <StatusPill label={`${d.probability ?? 0}%`} tone="navy" />
          </View>
          <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(d.value)}</Text>
          {d.clientName ? <Text style={[styles.body, { color: c.foreground }]}>{d.clientName}</Text> : null}
          <Text style={[styles.meta, { color: c.mutedForeground }]}>Expected close {fmtDate(d.expectedCloseDate)}</Text>
          {d.assignedToName ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Owner: {d.assignedToName}</Text> : null}
          {d.leadId ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Linked lead #{d.leadId}</Text> : null}
        </Card>

        <View style={styles.row}>
          <BrandButton label="Change stage" icon="repeat" variant="secondary" onPress={() => setStageOpen(true)} style={{ flex: 1 }} />
          <BrandButton label="Edit" icon="edit-2" onPress={() => router.push({ pathname: "/crm/deals/[id]/edit", params: { id: String(did) } })} style={{ flex: 1 }} />
        </View>

        <SectionHeading title={`Activity (${acts.data?.length ?? 0})`} action={
          <Pressable onPress={() => router.push({ pathname: "/crm/activities/new", params: { dealId: String(did) } })}>
            <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>Add</Text>
          </Pressable>
        } />
        {acts.isLoading ? <LoadingBlock /> : null}
        {!acts.isLoading && (acts.data?.length ?? 0) === 0 ? <EmptyState icon="activity" title="No activities" hint="Log calls, emails and meetings here." /> : null}
        {(acts.data ?? []).map(a => (
          <Card key={a.id}>
            <View style={styles.row}>
              <Feather name={activityTypeIcon(a.type) as never} size={14} color={c.primary} />
              <Text style={[styles.body, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{a.subject}</Text>
              {a.isDone ? <StatusPill label="Done" tone="success" /> : <StatusPill label={activityTypeLabel(a.type)} tone="blue" />}
            </View>
            {a.description ? <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={2}>{a.description}</Text> : null}
            <Text style={[styles.meta, { color: c.mutedForeground }]}>Due {fmtRelative(a.dueDate)}</Text>
          </Card>
        ))}

        {d.notes ? <><SectionHeading title="Notes" /><Card><Text style={[styles.body, { color: c.foreground }]}>{d.notes}</Text></Card></> : null}

        <BrandButton label="Delete deal" icon="trash-2" variant="ghost" onPress={onDelete} />
      </ScrollView>

      <ActionSheet
        visible={stageOpen}
        onClose={() => setStageOpen(false)}
        title="Change stage"
        actions={DEAL_STAGES.map(s => ({
          label: `Move to ${s.label}`, icon: "trending-up",
          onPress: () => update.mutate({ id: did, data: { ...body, stage: s.value } }),
        }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 22 },
});
