import React from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetRfqQueryKey, getListRfqsQueryKey,
  useGetRfq, useSendRfq,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { fmtDate, rfqStatusMeta } from "@/lib/format";

export default function RfqDetail() {
  const c = useColors();
  const qc = useQueryClient();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const rid = Number(id);
  const q = useGetRfq(rid);

  const send = useSendRfq({
    mutation: {
      onMutate: async () => {
        await qc.cancelQueries({ queryKey: getGetRfqQueryKey(rid) });
        const prev = qc.getQueryData(getGetRfqQueryKey(rid));
        qc.setQueryData(getGetRfqQueryKey(rid), (old: unknown) => ({ ...(old as object ?? {}), status: "sent" }));
        return { prev };
      },
      onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(getGetRfqQueryKey(rid), ctx.prev); Alert.alert("Could not send RFQ"); },
      onSettled: () => {
        qc.invalidateQueries({ queryKey: getGetRfqQueryKey(rid) });
        qc.invalidateQueries({ queryKey: getListRfqsQueryKey() });
      },
    },
  });

  if (q.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="RFQ" /><LoadingBlock /></View>;
  if (q.error || !q.data) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="RFQ" /><ErrorBlock message={(q.error as Error)?.message ?? "Not found"} onRetry={() => q.refetch()} /></View>;

  const r = q.data;
  const sm = rfqStatusMeta(r.status);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={r.rfqNumber} subtitle={r.prNumber ? `From ${r.prNumber}` : "Request for quotation"} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={sm.label} tone={sm.tone} />
            {r.requiredDeliveryDate ? <Text style={[styles.meta, { color: c.mutedForeground }]}>need {fmtDate(r.requiredDeliveryDate)}</Text> : null}
          </View>
          {r.paymentTerms ? <Text style={[styles.body, { color: c.foreground }]}>Terms: {r.paymentTerms}</Text> : null}
          {r.notes ? <Text style={[styles.body, { color: c.foreground }]}>{r.notes}</Text> : null}
        </Card>

        <View style={styles.row}>
          {r.status === "draft" ? (
            <BrandButton label="Send to suppliers" icon="send" loading={send.isPending} onPress={() => send.mutate({ id: rid })} style={{ flex: 1 }} />
          ) : null}
          <BrandButton label="Edit" icon="edit-3" variant="secondary"
            onPress={() => router.push({ pathname: "/procurement/rfqs/[id]/edit", params: { id: String(rid) } })} style={{ flex: 1 }} />
        </View>

        <SectionHeading title={`Suppliers (${(r.suppliers ?? r.supplierIds ?? []).length})`} />
        <Card>
          {(r.suppliers ?? []).map(s => (
            <Pressable key={s.id} onPress={() => router.push({ pathname: "/procurement/quotations/new", params: { rfqId: String(rid), supplierId: String(s.id) } })}>
              <Text style={[styles.body, { color: c.primary, marginVertical: 4 }]}>{s.name}</Text>
            </Pressable>
          ))}
          {!(r.suppliers ?? []).length && (r.supplierIds ?? []).map(id => (
            <Text key={id} style={[styles.body, { color: c.foreground, marginVertical: 4 }]}>Supplier #{id}</Text>
          ))}
        </Card>

        <BrandButton label="Record supplier quotation" icon="file-text" variant="secondary"
          onPress={() => router.push({ pathname: "/procurement/quotations/new", params: { rfqId: String(rid) } })} />

        <BrandButton label="Compare quotations" icon="bar-chart-2"
          onPress={() => router.push({ pathname: "/procurement/quotations/compare", params: { rfqId: String(rid) } })} />

        <SectionHeading title={`Items (${(r.items ?? []).length})`} />
        {(r.items ?? []).map((it, i) => (
          <Card key={i}>
            <Text style={[styles.body, { color: c.foreground }]}>{it.itemName}</Text>
            <Text style={[styles.meta, { color: c.mutedForeground }]}>{Number(it.quantity)} {it.unit}</Text>
            {it.specifications ? <Text style={[styles.meta, { color: c.mutedForeground }]}>{it.specifications}</Text> : null}
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
});
