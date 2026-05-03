import React, { useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetSupplierQuotationQueryKey, getListSupplierQuotationsQueryKey,
  useGetSupplierQuotation, useRejectSupplierQuotation, useSelectSupplierQuotation,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { fmtAed, fmtDate, sqStatusMeta } from "@/lib/format";

export default function QuotationDetail() {
  const c = useColors();
  const qc = useQueryClient();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sid = Number(id);
  const q = useGetSupplierQuotation(sid);
  const [reason, setReason] = useState("");

  const optimistic = (status: string, extra: Record<string, unknown> = {}) => ({
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: getGetSupplierQuotationQueryKey(sid) });
      const prev = qc.getQueryData(getGetSupplierQuotationQueryKey(sid));
      qc.setQueryData(getGetSupplierQuotationQueryKey(sid), (old: unknown) => ({ ...(old as object ?? {}), status, ...extra }));
      return { prev };
    },
    onError: (_e: unknown, _v: unknown, ctx?: { prev?: unknown }) => {
      if (ctx?.prev) qc.setQueryData(getGetSupplierQuotationQueryKey(sid), ctx.prev);
      Alert.alert("Update failed");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: getGetSupplierQuotationQueryKey(sid) });
      qc.invalidateQueries({ queryKey: getListSupplierQuotationsQueryKey() });
    },
  });
  const select = useSelectSupplierQuotation({ mutation: optimistic("selected") });
  const reject = useRejectSupplierQuotation({ mutation: optimistic("rejected") });

  if (q.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Quotation" /><LoadingBlock /></View>;
  if (q.error || !q.data) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Quotation" /><ErrorBlock message={(q.error as Error)?.message ?? "Not found"} onRetry={() => q.refetch()} /></View>;

  const s = q.data;
  const sm = sqStatusMeta(s.status);
  const editable = s.status === "received";

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={s.sqNumber} subtitle={s.supplierName ?? "Supplier quotation"} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={sm.label} tone={sm.tone} />
            {s.quotationDate ? <Text style={[styles.meta, { color: c.mutedForeground }]}>{fmtDate(s.quotationDate)}</Text> : null}
          </View>
          {s.rfqNumber ? <Text style={[styles.body, { color: c.foreground }]}>RFQ {s.rfqNumber}</Text> : null}
          {s.supplierQuotationRef ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Ref {s.supplierQuotationRef}</Text> : null}
          <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(s.total)}</Text>
          {s.selectionReason ? <Text style={[styles.meta, { color: c.mutedForeground, marginTop: 4 }]}>Note: {s.selectionReason}</Text> : null}
        </Card>

        {editable ? (
          <View style={{ gap: 8 }}>
            <SectionHeading title="Decision" />
            <BrandButton label="Edit" icon="edit-3" variant="secondary"
              onPress={() => router.push({ pathname: "/procurement/quotations/[id]/edit", params: { id: String(sid) } })} />
            <Card>
              <Text style={[styles.meta, { color: c.mutedForeground, marginBottom: 6 }]}>Selection / rejection reason (optional)</Text>
              <TextInput value={reason} onChangeText={setReason} placeholder="Reason"
                placeholderTextColor={c.mutedForeground} multiline
                style={[styles.input, { color: c.foreground, borderColor: c.border }]} />
              <BrandButton label="Select winner" icon="check-circle" loading={select.isPending}
                onPress={() => select.mutate({ id: sid, data: { reason } })} />
              <BrandButton label="Reject" icon="x-circle" variant="ghost" loading={reject.isPending}
                onPress={() => reject.mutate({ id: sid })} />
            </Card>
          </View>
        ) : null}

        {s.status === "selected" ? (
          <BrandButton label="Create PO" icon="shopping-cart"
            onPress={() => router.push({ pathname: "/procurement/pos/new", params: { supplierId: String(s.supplierId), fromSqId: String(sid) } })} />
        ) : null}

        {s.deliveryTime || s.paymentTerms || s.warranty ? (
          <>
            <SectionHeading title="Terms" />
            <Card>
              {s.deliveryTime ? <Text style={[styles.body, { color: c.foreground }]}>Delivery: {s.deliveryTime}</Text> : null}
              {s.paymentTerms ? <Text style={[styles.body, { color: c.foreground }]}>Payment: {s.paymentTerms}</Text> : null}
              {s.warranty ? <Text style={[styles.body, { color: c.foreground }]}>Warranty: {s.warranty}</Text> : null}
            </Card>
          </>
        ) : null}

        <SectionHeading title={`Items (${(s.items ?? []).length})`} />
        {(s.items ?? []).map((it, i) => (
          <Card key={i}>
            <Text style={[styles.body, { color: c.foreground }]}>{it.itemName}</Text>
            <View style={styles.row}>
              <Text style={[styles.meta, { color: c.mutedForeground }]}>{Number(it.quantity)} {it.unit}</Text>
              <Text style={[styles.meta, { color: c.mutedForeground }]}>· @ {fmtAed(it.unitPrice)}</Text>
              <Text style={[styles.meta, { color: c.primary }]}>· {fmtAed(it.total)}</Text>
            </View>
          </Card>
        ))}

        {s.notes ? <><SectionHeading title="Notes" /><Card><Text style={[styles.body, { color: c.foreground }]}>{s.notes}</Text></Card></> : null}
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
  input: { borderWidth: 1, borderRadius: 12, padding: 10, minHeight: 50, textAlignVertical: "top", fontFamily: "Inter_500Medium" },
});
