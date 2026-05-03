import React from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetJournalEntryQueryKey, getListJournalEntriesQueryKey,
  useApproveJournalEntry, useDeleteJournalEntry, useGetJournalEntry,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { fmtAed, fmtDate, jeStatusMeta } from "@/lib/format";

export default function JournalEntryDetail() {
  const c = useColors();
  const qc = useQueryClient();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const jid = Number(id);
  const q = useGetJournalEntry(jid);

  const approve = useApproveJournalEntry({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetJournalEntryQueryKey(jid) });
        qc.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
      },
      onError: (e: unknown) => Alert.alert("Approve failed", (e as Error).message ?? ""),
    },
  });
  const del = useDeleteJournalEntry({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Delete failed", (e as Error).message ?? ""),
    },
  });

  if (q.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Journal entry" /><LoadingBlock /></View>;
  if (q.error || !q.data) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Journal entry" /><ErrorBlock message={(q.error as Error)?.message ?? "Not found"} onRetry={() => q.refetch()} /></View>;

  const j = q.data;
  const sm = jeStatusMeta(j.status);
  const isDraft = (j.status ?? "").toLowerCase() === "draft";

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={j.journalNumber} subtitle={fmtDate(j.entryDate)} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={sm.label} tone={sm.tone} />
            {j.reference ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Ref: {j.reference}</Text> : null}
          </View>
          <Text style={[styles.body, { color: c.foreground }]}>{j.description}</Text>
          <View style={styles.row}>
            <Text style={[styles.amount, { color: c.primary }]}>Dr {fmtAed(j.totalDebit)}</Text>
            <Text style={[styles.meta, { color: c.mutedForeground }]}>· Cr {fmtAed(j.totalCredit)}</Text>
          </View>
          {j.preparedByName ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Prepared by {j.preparedByName}</Text> : null}
          {j.approvedByName ? <Text style={[styles.meta, { color: c.success }]}>Approved by {j.approvedByName}</Text> : null}
        </Card>

        {isDraft ? (
          <View style={styles.row}>
            <BrandButton label="Approve" icon="check" loading={approve.isPending} onPress={() => approve.mutate({ id: jid })} style={{ flex: 1 }} />
            <BrandButton label="Delete" icon="trash-2" variant="ghost" onPress={() => Alert.alert("Delete entry", "Cannot be undone.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => del.mutate({ id: jid }) },
            ])} style={{ flex: 1 }} />
          </View>
        ) : null}

        <SectionHeading title="Lines" />
        {(j.lines ?? []).map((l, i) => (
          <Card key={l.id ?? i}>
            <Text style={[styles.body, { color: c.foreground }]}>{l.accountName}</Text>
            {l.description ? <Text style={[styles.meta, { color: c.mutedForeground }]}>{l.description}</Text> : null}
            <View style={styles.row}>
              <Text style={[styles.meta, { color: c.foreground }]}>Dr {fmtAed(l.debit)}</Text>
              <Text style={[styles.meta, { color: c.foreground }]}>· Cr {fmtAed(l.credit)}</Text>
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
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 16 },
});
