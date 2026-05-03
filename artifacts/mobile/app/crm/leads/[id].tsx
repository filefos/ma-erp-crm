import React, { useState } from "react";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetLeadQueryKey,
  getListLeadsQueryKey,
  useDeleteLead,
  useGetLead,
  useListActivities,
  useUpdateLead,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, EmptyState, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { ActionSheet, StatusPill } from "@/components/forms";
import { LEAD_STATUSES, activityTypeIcon, activityTypeLabel, fmtDate, fmtRelative, leadScoreMeta, leadStatusMeta } from "@/lib/format";

export default function LeadDetail() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const leadId = Number(id);
  const lead = useGetLead(leadId);
  const acts = useListActivities({ leadId });
  const [statusOpen, setStatusOpen] = useState(false);

  const update = useUpdateLead({
    mutation: {
      onMutate: async (vars) => {
        await qc.cancelQueries({ queryKey: getGetLeadQueryKey(leadId) });
        const prev = qc.getQueryData(getGetLeadQueryKey(leadId));
        qc.setQueryData(getGetLeadQueryKey(leadId), (old: unknown) => ({ ...(old as object ?? {}), ...vars.data }));
        return { prev };
      },
      onError: (_e, _v, ctx) => {
        if (ctx?.prev) qc.setQueryData(getGetLeadQueryKey(leadId), ctx.prev);
        Alert.alert("Could not update lead");
      },
      onSettled: () => {
        qc.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) });
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      },
    },
  });

  const del = useDeleteLead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        router.back();
      },
      onError: (e: unknown) => Alert.alert("Could not delete", (e as Error).message ?? "Please try again."),
    },
  });

  if (lead.isLoading) {
    return (
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <AppHeader title="Lead" />
        <LoadingBlock label="Loading lead…" />
      </View>
    );
  }
  if (lead.error || !lead.data) {
    return (
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <AppHeader title="Lead" />
        <ErrorBlock message={(lead.error as Error)?.message ?? "Lead not found"} onRetry={() => lead.refetch()} />
      </View>
    );
  }

  const l = lead.data;
  const sm = leadStatusMeta(l.status);
  const score = leadScoreMeta(l.leadScore);

  const changeStatus = (status: string) => {
    update.mutate({
      id: leadId,
      data: {
        leadName: l.leadName, companyName: l.companyName, contactPerson: l.contactPerson,
        phone: l.phone, whatsapp: l.whatsapp, email: l.email, location: l.location,
        source: l.source, requirementType: l.requirementType, quantity: l.quantity,
        budget: l.budget, assignedToId: l.assignedToId, notes: l.notes,
        nextFollowUp: l.nextFollowUp, leadScore: l.leadScore, companyId: l.companyId,
        status,
      },
    });
  };

  const onDelete = () => {
    Alert.alert("Delete lead?", `${l.leadName} will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => del.mutate({ id: leadId }) },
    ]);
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={l.leadName} subtitle={l.leadNumber} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={lead.isRefetching} onRefresh={() => { lead.refetch(); acts.refetch(); }} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={sm.label} tone={sm.tone} />
            <StatusPill label={score.label} tone={score.tone} />
          </View>
          {l.companyName ? <Text style={[styles.body, { color: c.foreground }]}>{l.companyName}</Text> : null}
          {l.contactPerson ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Contact: {l.contactPerson}</Text> : null}
          {l.location ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Location: {l.location}</Text> : null}
          {l.assignedToName ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Owner: {l.assignedToName}</Text> : null}
          <Text style={[styles.meta, { color: c.mutedForeground }]}>Next follow-up: {fmtRelative(l.nextFollowUp)}</Text>
        </Card>

        <View style={styles.row}>
          {l.phone ? <ContactIcon icon="phone" onPress={() => Linking.openURL(`tel:${l.phone}`)} /> : null}
          {l.whatsapp ? <ContactIcon icon="message-circle" onPress={() => Linking.openURL(`https://wa.me/${(l.whatsapp ?? "").replace(/\D/g, "")}`)} /> : null}
          {l.email ? <ContactIcon icon="mail" onPress={() => Linking.openURL(`mailto:${l.email}`)} /> : null}
        </View>

        <View style={styles.row}>
          <BrandButton label="Change status" icon="repeat" variant="secondary" onPress={() => setStatusOpen(true)} style={{ flex: 1 }} />
          <BrandButton label="Edit" icon="edit-2" onPress={() => router.push({ pathname: "/crm/leads/[id]/edit", params: { id: String(leadId) } })} style={{ flex: 1 }} />
        </View>

        <SectionHeading title={`Activity (${acts.data?.length ?? 0})`} action={
          <Pressable onPress={() => router.push({ pathname: "/crm/activities/new", params: { leadId: String(leadId) } })}>
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
            <Text style={[styles.meta, { color: c.mutedForeground }]}>Due {fmtDate(a.dueDate)} · by {a.createdByName ?? "—"}</Text>
          </Card>
        ))}

        {l.notes ? (
          <>
            <SectionHeading title="Notes" />
            <Card><Text style={[styles.body, { color: c.foreground }]}>{l.notes}</Text></Card>
          </>
        ) : null}

        <BrandButton label="Delete lead" icon="trash-2" variant="ghost" onPress={onDelete} />
      </ScrollView>

      <ActionSheet
        visible={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Change status"
        actions={LEAD_STATUSES.map(s => ({ label: s.label, icon: "tag", onPress: () => changeStatus(s.value) }))}
      />
    </View>
  );
}

function ContactIcon({ icon, onPress }: { icon: "phone" | "message-circle" | "mail"; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.iconBtn, { backgroundColor: c.secondary, opacity: pressed ? 0.85 : 1 }]}>
      <Feather name={icon} size={18} color={c.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
