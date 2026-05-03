import React, { useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListSupplierQuotationsQueryKey,
  useGetRfq, useListSupplierQuotations,
  useRejectSupplierQuotation, useSelectSupplierQuotation,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, EmptyState, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { fmtAed, fmtDate, sqStatusMeta } from "@/lib/format";

const num = (v: unknown) => Number(v ?? 0) || 0;

export default function CompareQuotations() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { rfqId } = useLocalSearchParams<{ rfqId?: string }>();
  const rid = rfqId ? Number(rfqId) : 0;
  const rfq = useGetRfq(rid, {
    // @ts-expect-error -- queryKey not required by Orval helper at call site
    query: { enabled: !!rid },
  });
  const sqs = useListSupplierQuotations(rid ? { rfqId: rid } : undefined);
  const [busyId, setBusyId] = useState<number | null>(null);

  const list = useMemo(() => (sqs.data ?? []).slice().sort((a, b) => num(a.total) - num(b.total)), [sqs.data]);
  const cheapest = list[0]?.id;

  const itemKeys = useMemo(() => {
    const map = new Map<string, { name: string; unit?: string | null }>();
    list.forEach(sq => (sq.items ?? []).forEach(it => {
      const k = (it.itemName ?? "").trim().toLowerCase();
      if (k && !map.has(k)) map.set(k, { name: it.itemName ?? "", unit: it.unit });
    }));
    (rfq.data?.items ?? []).forEach(it => {
      const k = (it.itemName ?? "").trim().toLowerCase();
      if (k && !map.has(k)) map.set(k, { name: it.itemName ?? "", unit: it.unit });
    });
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
  }, [list, rfq.data]);

  const refresh = () => { sqs.refetch(); rfq.refetch(); };

  const settle = () => {
    qc.invalidateQueries({ queryKey: getListSupplierQuotationsQueryKey() });
    sqs.refetch();
    setBusyId(null);
  };
  const select = useSelectSupplierQuotation({
    mutation: { onSettled: settle, onError: () => Alert.alert("Could not select quotation") },
  });
  const reject = useRejectSupplierQuotation({
    mutation: { onSettled: settle, onError: () => Alert.alert("Could not reject quotation") },
  });

  if (!rid) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Compare quotations" /><EmptyState icon="file-text" title="Missing RFQ" hint="Open a quotation comparison from an RFQ." /></View>;
  if (sqs.isLoading || rfq.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Compare quotations" /><LoadingBlock /></View>;
  if (sqs.error) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Compare quotations" /><ErrorBlock message={(sqs.error as Error).message ?? ""} onRetry={refresh} /></View>;

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Compare quotations" subtitle={rfq.data?.rfqNumber ?? `RFQ #${rid}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={sqs.isRefetching} onRefresh={refresh} tintColor={c.primary} />}
      >
        {list.length === 0 ? <EmptyState icon="file-text" title="No quotations yet" hint="Suppliers haven't returned any quotations for this RFQ." /> : null}

        {list.length > 0 ? (
          <SectionHeading title={`Side-by-side (${list.length} supplier${list.length === 1 ? "" : "s"})`} />
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hContent}>
          {list.map(sq => {
            const sm = sqStatusMeta(sq.status);
            const isCheapest = sq.id === cheapest && (sq.status ?? "").toLowerCase() !== "rejected";
            const isWinner = (sq.status ?? "").toLowerCase() === "selected";
            const editable = (sq.status ?? "").toLowerCase() === "received";
            const items = sq.items ?? [];
            return (
              <Card key={sq.id} style={{ ...styles.col, borderWidth: isWinner ? 2 : isCheapest ? 1.5 : 0, borderColor: isWinner ? c.success : isCheapest ? c.primary : "transparent" }}>
                <Pressable onPress={() => router.push({ pathname: "/procurement/quotations/[id]", params: { id: String(sq.id) } })}>
                  <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>{sq.supplierName ?? `Supplier #${sq.supplierId}`}</Text>
                  <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={1}>{sq.sqNumber}{sq.quotationDate ? ` · ${fmtDate(sq.quotationDate)}` : ""}</Text>
                  <View style={styles.row}>
                    <StatusPill label={sm.label} tone={sm.tone} />
                    {isCheapest && !isWinner ? <StatusPill label="Lowest" tone="success" /> : null}
                    {isWinner ? <StatusPill label="Selected" tone="success" /> : null}
                  </View>
                  <Text style={[styles.amount, { color: c.primary, marginTop: 6 }]}>{fmtAed(sq.total)}</Text>
                </Pressable>

                <View style={styles.divider} />
                {itemKeys.map(({ key, name, unit }) => {
                  const it = items.find(x => (x.itemName ?? "").trim().toLowerCase() === key);
                  return (
                    <View key={key} style={styles.itemRow}>
                      <Text style={[styles.itemName, { color: c.foreground }]} numberOfLines={2}>{name}</Text>
                      {it ? (
                        <>
                          <Text style={[styles.meta, { color: c.mutedForeground }]}>{Number(it.quantity)} {it.unit ?? unit ?? ""}</Text>
                          <Text style={[styles.meta, { color: c.foreground }]}>@ {fmtAed(it.unitPrice)}</Text>
                          <Text style={[styles.meta, { color: c.primary }]}>{fmtAed(it.total)}</Text>
                        </>
                      ) : (
                        <Text style={[styles.meta, { color: c.mutedForeground }]}>—</Text>
                      )}
                    </View>
                  );
                })}

                {sq.deliveryTime || sq.paymentTerms || sq.warranty ? (
                  <>
                    <View style={styles.divider} />
                    {sq.deliveryTime ? <Text style={[styles.meta, { color: c.foreground }]}>Delivery: {sq.deliveryTime}</Text> : null}
                    {sq.paymentTerms ? <Text style={[styles.meta, { color: c.foreground }]}>Terms: {sq.paymentTerms}</Text> : null}
                    {sq.warranty ? <Text style={[styles.meta, { color: c.foreground }]}>Warranty: {sq.warranty}</Text> : null}
                  </>
                ) : null}

                {editable ? (
                  <View style={{ gap: 8, marginTop: 10 }}>
                    <BrandButton label="Select" icon="check-circle" loading={busyId === sq.id && select.isPending}
                      onPress={() => { setBusyId(sq.id ?? null); select.mutate({ id: sq.id ?? 0, data: { reason: "Selected via comparison" } }); }} />
                    <BrandButton label="Reject" icon="x-circle" variant="ghost" loading={busyId === sq.id && reject.isPending}
                      onPress={() => { setBusyId(sq.id ?? null); reject.mutate({ id: sq.id ?? 0 }); }} />
                  </View>
                ) : null}
                {isWinner ? (
                  <BrandButton label="Create PO" icon="shopping-cart"
                    onPress={() => router.push({ pathname: "/procurement/pos/new", params: { supplierId: String(sq.supplierId), fromSqId: String(sq.id) } })} />
                ) : null}
              </Card>
            );
          })}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  hContent: { gap: 12, paddingRight: 8 },
  col: { width: 260, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 18 },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 8 },
  itemRow: { paddingVertical: 4, gap: 2 },
  itemName: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
