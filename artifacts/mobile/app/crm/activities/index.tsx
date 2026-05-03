import React, { useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListActivitiesQueryKey,
  useDeleteActivity, useListActivities, useListContacts, useListDeals, useListLeads, useUpdateActivity,
  type Activity, type ListActivitiesParams,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { FormCell, FormRow, Select } from "@/components/forms";
import { StatusPill } from "@/components/forms";
import { ACTIVITY_TYPES, activityTypeIcon, activityTypeLabel, fmtRelative } from "@/lib/format";

export default function ActivitiesList() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const [type, setType] = useState<string>("");
  const [leadId, setLeadId] = useState<string>("");
  const [dealId, setDealId] = useState<string>("");
  const [contactId, setContactId] = useState<string>("");

  const params: ListActivitiesParams | undefined = useMemo(() => {
    const p: ListActivitiesParams = {};
    if (type) p.type = type;
    if (leadId) p.leadId = Number(leadId);
    if (dealId) p.dealId = Number(dealId);
    if (contactId) p.contactId = Number(contactId);
    return Object.keys(p).length ? p : undefined;
  }, [type, leadId, dealId, contactId]);

  const q = useListActivities(params);
  const leads = useListLeads();
  const deals = useListDeals();
  const contacts = useListContacts();

  const update = useUpdateActivity({
    mutation: {
      onMutate: async (vars) => {
        await qc.cancelQueries({ queryKey: getListActivitiesQueryKey() });
        const prev = qc.getQueryData(getListActivitiesQueryKey(params));
        qc.setQueryData<Activity[] | undefined>(getListActivitiesQueryKey(params), old =>
          (old ?? []).map(a => a.id === vars.id ? { ...a, ...vars.data } : a),
        );
        return { prev };
      },
      onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(getListActivitiesQueryKey(params), ctx.prev); Alert.alert("Update failed"); },
      onSettled: () => qc.invalidateQueries({ queryKey: getListActivitiesQueryKey() }),
    },
  });
  const del = useDeleteActivity({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListActivitiesQueryKey() }),
      onError: (e: unknown) => Alert.alert("Delete failed", (e as Error).message ?? ""),
    },
  });

  const data = q.data ?? [];
  const leadOpts = [{ value: "", label: "Any lead" }, ...((leads.data ?? []).map(l => ({ value: String(l.id), label: l.leadName, hint: l.leadNumber })))];
  const dealOpts = [{ value: "", label: "Any deal" }, ...((deals.data ?? []).map(d => ({ value: String(d.id), label: d.title, hint: d.dealNumber })))];
  const contactOpts = [{ value: "", label: "Any contact" }, ...((contacts.data ?? []).map(ct => ({ value: String(ct.id), label: ct.name, hint: ct.companyName ?? ct.email ?? "" })))];

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Activities" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Select label="Type" value={type} options={[{ value: "", label: "All types" }, ...ACTIVITY_TYPES]} onChange={setType} />
        <FormRow>
          <FormCell><Select label="Lead" value={leadId} options={leadOpts} onChange={setLeadId} /></FormCell>
          <FormCell><Select label="Deal" value={dealId} options={dealOpts} onChange={setDealId} /></FormCell>
        </FormRow>
        <Select label="Contact" value={contactId} options={contactOpts} onChange={setContactId} />
        <BrandButton label="New activity" icon="plus" onPress={() => router.push("/crm/activities/new")} />

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="activity" title="No activities" hint="Log your calls, meetings and tasks." /> : null}

        {data.map(a => (
          <Card key={a.id}>
            <View style={styles.row}>
              <Feather name={activityTypeIcon(a.type) as never} size={14} color={c.primary} />
              <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{a.subject}</Text>
              {a.isDone
                ? <StatusPill label="Done" tone="success" />
                : <StatusPill label={activityTypeLabel(a.type)} tone="blue" />}
            </View>
            {a.description ? <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={2}>{a.description}</Text> : null}
            <Text style={[styles.meta, { color: c.mutedForeground }]}>Due {fmtRelative(a.dueDate)} · by {a.createdByName ?? "—"}</Text>
            <View style={styles.row}>
              <Pressable
                onPress={() => update.mutate({ id: a.id, data: { type: a.type, subject: a.subject, description: a.description, dueDate: a.dueDate, leadId: a.leadId, dealId: a.dealId, contactId: a.contactId, isDone: !a.isDone } })}
                style={({ pressed }) => [styles.btn, { backgroundColor: c.secondary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Feather name={a.isDone ? "rotate-ccw" : "check"} size={14} color={c.primary} />
                <Text style={[styles.btnLabel, { color: c.primary }]}>{a.isDone ? "Reopen" : "Mark done"}</Text>
              </Pressable>
              <Pressable
                onPress={() => Alert.alert("Delete activity?", a.subject, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => del.mutate({ id: a.id }) },
                ])}
                style={({ pressed }) => [styles.btn, { backgroundColor: c.muted, opacity: pressed ? 0.85 : 1 }]}
              >
                <Feather name="trash-2" size={14} color={c.destructive} />
                <Text style={[styles.btnLabel, { color: c.destructive }]}>Delete</Text>
              </Pressable>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  btnLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
