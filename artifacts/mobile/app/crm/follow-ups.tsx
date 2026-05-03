import React, { useMemo } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListActivitiesQueryKey, getListLeadsQueryKey,
  useListActivities, useListLeads,
  useUpdateActivity,
  type Activity,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { Card, EmptyState, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { activityTypeIcon, activityTypeLabel, fmtRelative, isOverdue } from "@/lib/format";

export default function FollowUps() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const acts = useListActivities();
  const leads = useListLeads();

  const update = useUpdateActivity({
    mutation: {
      onMutate: async (vars) => {
        await qc.cancelQueries({ queryKey: getListActivitiesQueryKey() });
        const prev = qc.getQueryData<Activity[] | undefined>(getListActivitiesQueryKey());
        qc.setQueryData<Activity[] | undefined>(getListActivitiesQueryKey(), old => (old ?? []).map(a => a.id === vars.id ? { ...a, isDone: vars.data.isDone ?? a.isDone } : a));
        return { prev };
      },
      onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(getListActivitiesQueryKey(), ctx.prev); Alert.alert("Update failed"); },
      onSettled: () => qc.invalidateQueries({ queryKey: getListActivitiesQueryKey() }),
    },
  });

  const today = new Date(); today.setHours(23, 59, 59, 999);
  const tomorrow = today.getTime() + 86_400_000;
  const open = (acts.data ?? []).filter(a => !a.isDone && a.dueDate);
  const overdue = open.filter(a => isOverdue(a.dueDate));
  const dueToday = open.filter(a => !isOverdue(a.dueDate) && new Date(a.dueDate ?? "").getTime() <= today.getTime());
  const upcoming = open.filter(a => new Date(a.dueDate ?? "").getTime() > today.getTime() && new Date(a.dueDate ?? "").getTime() <= tomorrow + 86_400_000 * 6);

  const overdueLeads = useMemo(() => (leads.data ?? []).filter(l => isOverdue(l.nextFollowUp) && !["won", "lost"].includes((l.status ?? "").toLowerCase())), [leads.data]);
  const refreshing = acts.isRefetching || leads.isRefetching;

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Follow-up center" subtitle="Today, overdue and upcoming" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { acts.refetch(); leads.refetch(); }} tintColor={c.primary} />}
      >
        {acts.isLoading ? <LoadingBlock /> : null}
        {acts.error ? <ErrorBlock message={(acts.error as Error).message ?? ""} onRetry={() => acts.refetch()} /> : null}

        <SectionHeading title={`Overdue (${overdue.length})`} />
        {overdue.length === 0 ? <EmptyState icon="check-circle" title="Nothing overdue" hint="Great work — you're on top of things." /> : null}
        {overdue.map(a => <ActivityRow key={a.id} a={a} onToggle={() => update.mutate({ id: a.id, data: { type: a.type, subject: a.subject, description: a.description, dueDate: a.dueDate, leadId: a.leadId, dealId: a.dealId, contactId: a.contactId, isDone: true } })} />)}

        <SectionHeading title={`Today (${dueToday.length})`} />
        {dueToday.length === 0 ? <EmptyState icon="sun" title="Nothing due today" /> : null}
        {dueToday.map(a => <ActivityRow key={a.id} a={a} onToggle={() => update.mutate({ id: a.id, data: { type: a.type, subject: a.subject, description: a.description, dueDate: a.dueDate, leadId: a.leadId, dealId: a.dealId, contactId: a.contactId, isDone: true } })} />)}

        <SectionHeading title={`Next 7 days (${upcoming.length})`} />
        {upcoming.length === 0 ? <EmptyState icon="calendar" title="Nothing coming up" /> : null}
        {upcoming.map(a => <ActivityRow key={a.id} a={a} onToggle={() => update.mutate({ id: a.id, data: { type: a.type, subject: a.subject, description: a.description, dueDate: a.dueDate, leadId: a.leadId, dealId: a.dealId, contactId: a.contactId, isDone: true } })} />)}

        <SectionHeading title={`Overdue lead follow-ups (${overdueLeads.length})`} />
        {overdueLeads.length === 0 ? <EmptyState icon="users" title="No overdue lead follow-ups" /> : null}
        {overdueLeads.map(l => (
          <Pressable key={l.id} onPress={() => router.push({ pathname: "/crm/leads/[id]", params: { id: String(l.id) } })}>
            <Card>
              <View style={styles.row}>
                <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{l.leadName}</Text>
                <StatusPill label={fmtRelative(l.nextFollowUp)} tone="destructive" />
              </View>
              <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={1}>{l.companyName ?? l.contactPerson ?? l.leadNumber}</Text>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ActivityRow({ a, onToggle }: { a: Activity; onToggle: () => void }) {
  const c = useColors();
  return (
    <Card>
      <View style={styles.row}>
        <Feather name={activityTypeIcon(a.type) as never} size={14} color={c.primary} />
        <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{a.subject}</Text>
        <StatusPill label={isOverdue(a.dueDate) ? "Overdue" : activityTypeLabel(a.type)} tone={isOverdue(a.dueDate) ? "destructive" : "blue"} />
      </View>
      <Text style={[styles.meta, { color: c.mutedForeground }]}>Due {fmtRelative(a.dueDate)}</Text>
      <Pressable onPress={onToggle} style={({ pressed }) => [styles.markBtn, { backgroundColor: c.secondary, opacity: pressed ? 0.85 : 1 }]}>
        <Feather name="check" size={14} color={c.primary} />
        <Text style={[styles.markLbl, { color: c.primary }]}>Mark done</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { fontFamily: "Inter_700Bold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  markBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  markLbl: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
