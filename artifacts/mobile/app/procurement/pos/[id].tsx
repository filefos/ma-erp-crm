import React, { useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetPurchaseOrderQueryKey, getListPurchaseOrdersQueryKey,
  useApprovePurchaseOrder, useCancelPurchaseOrder, useGetPurchaseOrder,
  useIssuePurchaseOrder, useRejectPurchaseOrder, useSubmitPurchaseOrder,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { fmtAed, fmtDate, poStatusMeta } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";
import { isAdmin } from "@/lib/permissions";
import { previewPoPdf, sharePoPdf } from "@/lib/poPdf";

export default function PoDetail() {
  const c = useColors();
  const qc = useQueryClient();
  const router = useRouter();
  const { user, activeCompany } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pid = Number(id);
  const q = useGetPurchaseOrder(pid);
  const [reason, setReason] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [closing, setClosing] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const optimistic = (status: string, extra: Record<string, unknown> = {}) => ({
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: getGetPurchaseOrderQueryKey(pid) });
      const prev = qc.getQueryData(getGetPurchaseOrderQueryKey(pid));
      qc.setQueryData(getGetPurchaseOrderQueryKey(pid), (old: unknown) => ({ ...(old as object ?? {}), status, ...extra }));
      return { prev };
    },
    onError: (_e: unknown, _v: unknown, ctx?: { prev?: unknown }) => {
      if (ctx?.prev) qc.setQueryData(getGetPurchaseOrderQueryKey(pid), ctx.prev);
      Alert.alert("Update failed");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: getGetPurchaseOrderQueryKey(pid) });
      qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
    },
  });

  const submit  = useSubmitPurchaseOrder({ mutation: optimistic("submitted") });
  const approve = useApprovePurchaseOrder({ mutation: optimistic("approved") });
  const reject  = useRejectPurchaseOrder({ mutation: optimistic("rejected") });
  const issue   = useIssuePurchaseOrder({ mutation: optimistic("issued") });
  const close   = useCancelPurchaseOrder({ mutation: optimistic("cancelled") });

  if (q.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="PO" /><LoadingBlock /></View>;
  if (q.error || !q.data) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="PO" /><ErrorBlock message={(q.error as Error)?.message ?? "Not found"} onRetry={() => q.refetch()} /></View>;

  const p = q.data;
  const sm = poStatusMeta(p.status);
  const canApprove = isAdmin(user) && p.status === "submitted";
  const canEdit = ["draft", "rejected"].includes((p.status ?? "").toLowerCase());
  const canIssue = (p.status ?? "").toLowerCase() === "approved";
  const canClose = !["closed", "cancelled", "rejected"].includes((p.status ?? "").toLowerCase());

  const onPreviewPdf = async () => {
    try { setPdfBusy(true); await previewPoPdf(p, activeCompany?.name ?? activeCompany?.short ?? null); }
    catch (e) { Alert.alert("PDF failed", (e as Error).message); }
    finally { setPdfBusy(false); }
  };
  const onSharePdf = async () => {
    try { setPdfBusy(true); await sharePoPdf(p, activeCompany?.name ?? activeCompany?.short ?? null); }
    catch (e) { Alert.alert("Share failed", (e as Error).message); }
    finally { setPdfBusy(false); }
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={p.poNumber} subtitle={p.supplierName ?? "Purchase order"} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={sm.label} tone={sm.tone} />
            {p.deliveryDate ? <Text style={[styles.meta, { color: c.mutedForeground }]}>deliver {fmtDate(p.deliveryDate)}</Text> : null}
          </View>
          <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(p.total)}</Text>
          {p.paymentTerms ? <Text style={[styles.meta, { color: c.mutedForeground }]}>{p.paymentTerms}</Text> : null}
        </Card>

        <View style={styles.row}>
          <BrandButton label="View PDF" icon="file-text" variant="secondary" loading={pdfBusy} onPress={onPreviewPdf} style={{ flex: 1 }} />
          <BrandButton label="Share PDF" icon="share-2" loading={pdfBusy} onPress={onSharePdf} style={{ flex: 1 }} />
        </View>

        <View style={styles.row}>
          {canEdit ? (
            <BrandButton label="Edit" icon="edit-3" variant="secondary"
              onPress={() => router.push({ pathname: "/procurement/pos/[id]/edit", params: { id: String(pid) } })} style={{ flex: 1 }} />
          ) : null}
          {p.status === "draft" ? (
            <BrandButton label="Submit" icon="send" loading={submit.isPending} onPress={() => submit.mutate({ id: pid })} style={{ flex: 1 }} />
          ) : null}
          {canIssue ? (
            <BrandButton label="Issue" icon="check-square" loading={issue.isPending} onPress={() => issue.mutate({ id: pid })} style={{ flex: 1 }} />
          ) : null}
          {canClose ? (
            <BrandButton label="Close" icon="x" variant="ghost" onPress={() => setClosing(true)} style={{ flex: 1 }} />
          ) : null}
        </View>

        {closing ? (
          <Card>
            <SectionHeading title="Close purchase order" />
            <Text style={[styles.meta, { color: c.mutedForeground, marginBottom: 6 }]}>Reason</Text>
            <TextInput
              value={closeReason} onChangeText={setCloseReason} placeholder="Why are you closing this PO?"
              placeholderTextColor={c.mutedForeground} multiline
              style={[styles.input, { color: c.foreground, borderColor: c.border }]} />
            <View style={styles.row}>
              <BrandButton label="Confirm close" icon="check" loading={close.isPending}
                onPress={() => {
                  if (!closeReason.trim()) return Alert.alert("Reason required");
                  close.mutate({ id: pid, data: { reason: closeReason } }, {
                    onSuccess: () => { setClosing(false); setCloseReason(""); },
                  });
                }} style={{ flex: 1 }} />
              <BrandButton label="Back" variant="ghost" onPress={() => setClosing(false)} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : null}

        {canApprove ? (
          <View style={{ gap: 8 }}>
            <SectionHeading title="Approve / reject" />
            <BrandButton label="Approve" icon="check-circle" loading={approve.isPending} onPress={() => approve.mutate({ id: pid })} />
            <Card>
              <Text style={[styles.meta, { color: c.mutedForeground, marginBottom: 6 }]}>Rejection reason</Text>
              <TextInput
                value={reason} onChangeText={setReason} placeholder="Reason"
                placeholderTextColor={c.mutedForeground} multiline
                style={[styles.input, { color: c.foreground, borderColor: c.border }]} />
              <BrandButton label="Reject" icon="x-circle" variant="ghost" loading={reject.isPending}
                onPress={() => {
                  if (!reason.trim()) return Alert.alert("Reason required");
                  reject.mutate({ id: pid, data: { reason } });
                }} />
            </Card>
          </View>
        ) : null}

        <SectionHeading title={`Items (${(p.items ?? []).length})`} />
        {(p.items ?? []).map((it, i) => (
          <Card key={i}>
            <Text style={[styles.body, { color: c.foreground }]}>{it.itemName}</Text>
            <View style={styles.row}>
              <Text style={[styles.meta, { color: c.mutedForeground }]}>{Number(it.quantity)} {it.unit} @ {fmtAed(it.unitPrice)}</Text>
              <Text style={[styles.meta, { color: c.primary }]}>· {fmtAed(it.amount)}</Text>
            </View>
          </Card>
        ))}

        <Card style={{ backgroundColor: c.secondary }}>
          <View style={styles.totalRow}><Text style={{ color: c.foreground }}>Subtotal</Text><Text style={[styles.body, { color: c.foreground }]}>{fmtAed(p.subtotal)}</Text></View>
          <View style={styles.totalRow}><Text style={{ color: c.foreground }}>VAT</Text><Text style={[styles.body, { color: c.foreground }]}>{fmtAed(p.vatAmount)}</Text></View>
          <View style={styles.totalRow}><Text style={[styles.amount, { color: c.navy, fontSize: 16 }]}>Total</Text><Text style={[styles.amount, { color: c.navy, fontSize: 16 }]}>{fmtAed(p.total)}</Text></View>
        </Card>
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
  amount: { fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 6 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  input: { borderWidth: 1, borderRadius: 12, padding: 10, minHeight: 60, textAlignVertical: "top", fontFamily: "Inter_500Medium" },
});
