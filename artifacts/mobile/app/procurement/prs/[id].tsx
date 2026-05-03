import React, { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetPurchaseRequestQueryKey, getListPurchaseRequestsQueryKey,
  useApprovePurchaseRequest, useGetPurchaseRequest, useRejectPurchaseRequest, useSubmitPurchaseRequest,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { fmtAed, fmtDate, prPriorityMeta, prStatusMeta } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";
import { isAdmin } from "@/lib/permissions";

export default function PrDetail() {
  const c = useColors();
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pid = Number(id);
  const q = useGetPurchaseRequest(pid);
  const [reason, setReason] = useState("");

  const optimisticStatus = (status: string, extra: Record<string, unknown> = {}) => ({
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: getGetPurchaseRequestQueryKey(pid) });
      const prev = qc.getQueryData(getGetPurchaseRequestQueryKey(pid));
      qc.setQueryData(getGetPurchaseRequestQueryKey(pid), (old: unknown) => ({ ...(old as object ?? {}), status, ...extra }));
      return { prev };
    },
    onError: (_e: unknown, _v: unknown, ctx?: { prev?: unknown }) => {
      if (ctx?.prev) qc.setQueryData(getGetPurchaseRequestQueryKey(pid), ctx.prev);
      Alert.alert("Update failed");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: getGetPurchaseRequestQueryKey(pid) });
      qc.invalidateQueries({ queryKey: getListPurchaseRequestsQueryKey() });
    },
  });

  const submit  = useSubmitPurchaseRequest({ mutation: optimisticStatus("submitted") });
  const approve = useApprovePurchaseRequest({ mutation: optimisticStatus("approved", { approvedByName: user?.name }) });
  const reject  = useRejectPurchaseRequest({ mutation: optimisticStatus("rejected") });

  if (q.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="PR" /><LoadingBlock /></View>;
  if (q.error || !q.data) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="PR" /><ErrorBlock message={(q.error as Error)?.message ?? "Not found"} onRetry={() => q.refetch()} /></View>;

  const p = q.data;
  const sm = prStatusMeta(p.status);
  const pm = prPriorityMeta(p.priority);
  const canApprove = isAdmin(user) && p.status === "submitted";
  const canEdit = ["draft", "rejected"].includes((p.status ?? "").toLowerCase());
  const total = (p.items ?? []).reduce((s, it) => s + Number(it.estimatedCost ?? 0), 0);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={p.prNumber} subtitle={p.department ?? "Purchase request"} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={sm.label} tone={sm.tone} />
            {p.priority ? <StatusPill label={pm.label} tone={pm.tone} /> : null}
            {p.requiredDate ? <Text style={[styles.meta, { color: c.mutedForeground }]}>need {fmtDate(p.requiredDate)}</Text> : null}
          </View>
          <Text style={[styles.body, { color: c.foreground, marginTop: 6 }]}>{p.description}</Text>
          {p.requestedByName ? <Text style={[styles.meta, { color: c.mutedForeground, marginTop: 4 }]}>By {p.requestedByName}</Text> : null}
          {p.approvedByName ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Approved by {p.approvedByName}</Text> : null}
          {p.rejectionReason ? <Text style={[styles.meta, { color: c.destructive, marginTop: 4 }]}>Rejected: {p.rejectionReason}</Text> : null}
        </Card>

        <View style={styles.row}>
          {canEdit ? (
            <BrandButton label="Edit" icon="edit-3" variant="secondary" onPress={() => router.push({ pathname: "/procurement/prs/[id]/edit", params: { id: String(pid) } })} style={{ flex: 1 }} />
          ) : null}
          {p.status === "draft" ? (
            <BrandButton label="Submit" icon="send" loading={submit.isPending} onPress={() => submit.mutate({ id: pid })} style={{ flex: 1 }} />
          ) : null}
          {p.status === "approved" ? (
            <BrandButton label="Create RFQ" icon="send" onPress={() => router.push({ pathname: "/procurement/rfqs/new", params: { prId: String(pid) } })} style={{ flex: 1 }} />
          ) : null}
        </View>

        {canApprove ? (
          <View style={{ gap: 8 }}>
            <SectionHeading title="Approve / reject" />
            <BrandButton label="Approve" icon="check-circle" loading={approve.isPending} onPress={() => approve.mutate({ id: pid })} />
            <Card>
              <Text style={[styles.meta, { color: c.mutedForeground, marginBottom: 6 }]}>Rejection reason</Text>
              <TextInput
                value={reason} onChangeText={setReason} placeholder="Reason"
                placeholderTextColor={c.mutedForeground}
                multiline
                style={[styles.input, { color: c.foreground, borderColor: c.border }]}
              />
              <BrandButton
                label="Reject" icon="x-circle" variant="ghost"
                loading={reject.isPending}
                onPress={() => {
                  if (!reason.trim()) return Alert.alert("Reason required");
                  reject.mutate({ id: pid, data: { reason } });
                }}
              />
            </Card>
          </View>
        ) : null}

        <SectionHeading title={`Items (${(p.items ?? []).length})`} />
        {(p.items ?? []).map((it, i) => (
          <Card key={i}>
            <Text style={[styles.body, { color: c.foreground }]} numberOfLines={2}>{it.itemName}</Text>
            <View style={styles.row}>
              <Text style={[styles.meta, { color: c.mutedForeground }]}>{Number(it.quantity)} {it.unit}</Text>
              {it.estimatedCost != null ? <Text style={[styles.meta, { color: c.primary }]}>· est {fmtAed(it.estimatedCost)}</Text> : null}
            </View>
          </Card>
        ))}
        {total > 0 ? <Text style={[styles.total, { color: c.navy }]}>Estimated total: {fmtAed(total)}</Text> : null}
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
  total: { fontFamily: "Inter_700Bold", fontSize: 16, textAlign: "right", marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 10, minHeight: 60, textAlignVertical: "top", fontFamily: "Inter_500Medium" },
});
