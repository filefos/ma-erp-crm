import React, { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetQuotationQueryKey, getListQuotationsQueryKey,
  useApproveQuotation, useDeleteQuotation, useGetQuotation, useUpdateQuotation,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { ActionSheet, StatusPill } from "@/components/forms";
import { DocumentWebView } from "@/components/DocumentWebView";
import { QUOTATION_STATUSES, fmtAed, fmtDate, quotationStatusMeta } from "@/lib/format";
import { quotationHtml } from "@/lib/document-html";

export default function QuotationDetail() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qid = Number(id);
  const q = useGetQuotation(qid);
  const [statusOpen, setStatusOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  const update = useUpdateQuotation({
    mutation: {
      onMutate: async (vars) => {
        await qc.cancelQueries({ queryKey: getGetQuotationQueryKey(qid) });
        const prev = qc.getQueryData(getGetQuotationQueryKey(qid));
        qc.setQueryData(getGetQuotationQueryKey(qid), (old: unknown) => ({ ...(old as object ?? {}), ...vars.data }));
        return { prev };
      },
      onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(getGetQuotationQueryKey(qid), ctx.prev); Alert.alert("Update failed"); },
      onSettled: () => {
        qc.invalidateQueries({ queryKey: getGetQuotationQueryKey(qid) });
        qc.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
      },
    },
  });
  const approve = useApproveQuotation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetQuotationQueryKey(qid) });
        qc.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
      },
      onError: (e: unknown) => Alert.alert("Approve failed", (e as Error).message ?? ""),
    },
  });
  const del = useDeleteQuotation({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListQuotationsQueryKey() }); router.back(); },
      onError: (e: unknown) => Alert.alert("Delete failed", (e as Error).message ?? ""),
    },
  });

  if (q.isLoading) {
    return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Quotation" /><LoadingBlock /></View>;
  }
  if (q.error || !q.data) {
    return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Quotation" /><ErrorBlock message={(q.error as Error)?.message ?? "Not found"} onRetry={() => q.refetch()} /></View>;
  }
  const qt = q.data;
  const sm = quotationStatusMeta(qt.status);

  const changeStatus = (status: string) => {
    update.mutate({
      id: qid,
      data: {
        companyId: qt.companyId, clientName: qt.clientName, clientEmail: qt.clientEmail,
        clientPhone: qt.clientPhone, clientContactPerson: qt.clientContactPerson, customerTrn: qt.customerTrn,
        projectName: qt.projectName, projectLocation: qt.projectLocation,
        discount: qt.discount, vatPercent: qt.vatPercent,
        paymentTerms: qt.paymentTerms, deliveryTerms: qt.deliveryTerms,
        validity: qt.validity, termsConditions: qt.termsConditions,
        techSpecs: qt.techSpecs, additionalItems: qt.additionalItems,
        leadId: qt.leadId, dealId: qt.dealId,
        items: (qt.items ?? []).map(it => ({
          description: it.description, quantity: it.quantity, unit: it.unit,
          rate: it.rate, discount: it.discount, sortOrder: it.sortOrder,
        })),
        status,
      },
    });
  };

  const onDelete = () => Alert.alert("Delete quotation?", qt.quotationNumber, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => del.mutate({ id: qid }) },
  ]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={qt.quotationNumber} subtitle={qt.clientName} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}><StatusPill label={sm.label} tone={sm.tone} />{qt.validity ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Valid till {fmtDate(qt.validity)}</Text> : null}</View>
          {qt.projectName ? <Text style={[styles.body, { color: c.foreground }]}>{qt.projectName}</Text> : null}
          {qt.projectLocation ? <Text style={[styles.meta, { color: c.mutedForeground }]}>{qt.projectLocation}</Text> : null}
          {qt.preparedByName ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Prepared by {qt.preparedByName}</Text> : null}
          {qt.approvedByName ? <Text style={[styles.meta, { color: c.success }]}>Approved by {qt.approvedByName}</Text> : null}
        </Card>

        <View style={styles.row}>
          <BrandButton label="View PDF" icon="file-text" variant="secondary" onPress={() => setPdfOpen(true)} style={{ flex: 1 }} />
          <BrandButton label="Status" icon="repeat" variant="secondary" onPress={() => setStatusOpen(true)} style={{ flex: 1 }} />
        </View>
        <View style={styles.row}>
          <BrandButton label="Edit" icon="edit-2" onPress={() => router.push({ pathname: "/sales/quotations/[id]/edit", params: { id: String(qid) } })} style={{ flex: 1 }} />
          {qt.status !== "approved" ? (
            <BrandButton label="Approve" icon="check-circle" variant="accent"
              loading={approve.isPending}
              onPress={() => Alert.alert("Approve quotation?", `${qt.quotationNumber} will be marked approved.`, [
                { text: "Cancel", style: "cancel" },
                { text: "Approve", onPress: () => approve.mutate({ id: qid }) },
              ])}
              style={{ flex: 1 }} />
          ) : null}
        </View>

        <SectionHeading title={`Items (${qt.items?.length ?? 0})`} />
        {(qt.items ?? []).map((it, idx) => (
          <Card key={it.id}>
            <View style={styles.row}>
              <Text style={[styles.itemIdx, { color: c.mutedForeground }]}>#{idx + 1}</Text>
              <Text style={[styles.body, { color: c.foreground, flex: 1 }]} numberOfLines={2}>{it.description}</Text>
            </View>
            <Text style={[styles.meta, { color: c.mutedForeground }]}>
              {it.quantity} {it.unit} × {fmtAed(it.rate)}{it.discount ? ` (-${it.discount}%)` : ""}
            </Text>
            <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(it.amount)}</Text>
          </Card>
        ))}

        <Card style={{ backgroundColor: c.secondary }}>
          <Row label="Subtotal" value={fmtAed(qt.subtotal)} />
          <Row label={`Discount${qt.discount ? ` (${qt.discount}%)` : ""}`} value={qt.discount ? `-${fmtAed(Number(qt.subtotal ?? 0) * Number(qt.discount) / 100)}` : fmtAed(0)} />
          <Row label={`VAT (${qt.vatPercent ?? 0}%)`} value={fmtAed(qt.vatAmount)} />
          <Row label="Grand total" value={fmtAed(qt.grandTotal)} bold />
        </Card>

        {qt.paymentTerms ? <><SectionHeading title="Payment terms" /><Card><Text style={[styles.body, { color: c.foreground }]}>{qt.paymentTerms}</Text></Card></> : null}
        {qt.deliveryTerms ? <><SectionHeading title="Delivery terms" /><Card><Text style={[styles.body, { color: c.foreground }]}>{qt.deliveryTerms}</Text></Card></> : null}
        {qt.termsConditions ? <><SectionHeading title="Terms & conditions" /><Card><Text style={[styles.body, { color: c.foreground }]}>{qt.termsConditions}</Text></Card></> : null}

        <BrandButton label="Delete quotation" icon="trash-2" variant="ghost" onPress={onDelete} />
      </ScrollView>

      <ActionSheet
        visible={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Change status"
        actions={QUOTATION_STATUSES.map(s => ({ label: s.label, icon: "tag", onPress: () => changeStatus(s.value) }))}
      />
      <DocumentWebView visible={pdfOpen} onClose={() => setPdfOpen(false)} title={qt.quotationNumber} html={quotationHtml(qt)} />
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.totalRow]}>
      <Text style={[bold ? styles.grand : styles.body, { color: bold ? c.navy : c.foreground }]}>{label}</Text>
      <Text style={[bold ? styles.grand : styles.body, { color: bold ? c.navy : c.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right" },
  itemIdx: { fontFamily: "Inter_700Bold", fontSize: 13 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  grand: { fontFamily: "Inter_700Bold", fontSize: 16 },
});
