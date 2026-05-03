import React, { useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetProformaInvoiceQueryKey, getListProformaInvoicesQueryKey,
  useGetProformaInvoice, useUpdateProformaInvoice,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { ActionSheet, StatusPill } from "@/components/forms";
import { DocumentWebView } from "@/components/DocumentWebView";
import { PI_STATUSES, fmtAed, fmtDate, piStatusMeta } from "@/lib/format";
import { proformaHtml } from "@/lib/document-html";

export default function PiDetail() {
  const c = useColors();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pid = Number(id);
  const q = useGetProformaInvoice(pid);
  const [statusOpen, setStatusOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  const update = useUpdateProformaInvoice({
    mutation: {
      onMutate: async (vars) => {
        await qc.cancelQueries({ queryKey: getGetProformaInvoiceQueryKey(pid) });
        const prev = qc.getQueryData(getGetProformaInvoiceQueryKey(pid));
        qc.setQueryData(getGetProformaInvoiceQueryKey(pid), (old: unknown) => ({ ...(old as object ?? {}), ...vars.data }));
        return { prev };
      },
      onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(getGetProformaInvoiceQueryKey(pid), ctx.prev); Alert.alert("Update failed"); },
      onSettled: () => {
        qc.invalidateQueries({ queryKey: getGetProformaInvoiceQueryKey(pid) });
        qc.invalidateQueries({ queryKey: getListProformaInvoicesQueryKey() });
      },
    },
  });

  if (q.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Proforma" /><LoadingBlock /></View>;
  if (q.error || !q.data) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Proforma" /><ErrorBlock message={(q.error as Error)?.message ?? "Not found"} onRetry={() => q.refetch()} /></View>;

  const p = q.data;
  const sm = piStatusMeta(p.status);

  const changeStatus = (status: string) => {
    update.mutate({
      id: pid,
      data: {
        companyId: p.companyId, clientName: p.clientName, projectName: p.projectName,
        quotationId: p.quotationId, subtotal: p.subtotal, vatAmount: p.vatAmount,
        total: p.total, paymentTerms: p.paymentTerms, validityDate: p.validityDate, status,
      },
    });
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={p.piNumber} subtitle={p.clientName} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={sm.label} tone={sm.tone} />
            {p.validityDate ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Valid till {fmtDate(p.validityDate)}</Text> : null}
          </View>
          {p.projectName ? <Text style={[styles.body, { color: c.foreground }]}>{p.projectName}</Text> : null}
          {p.quotationNumber ? <Text style={[styles.meta, { color: c.mutedForeground }]}>From quotation {p.quotationNumber}</Text> : null}
          <Text style={[styles.meta, { color: c.mutedForeground }]}>Created {fmtDate(p.createdAt)}</Text>
        </Card>

        <View style={styles.row}>
          <BrandButton label="View PDF" icon="file-text" variant="secondary" onPress={() => setPdfOpen(true)} style={{ flex: 1 }} />
          <BrandButton label="Status" icon="repeat" onPress={() => setStatusOpen(true)} style={{ flex: 1 }} />
        </View>

        <SectionHeading title="Totals" />
        <Card style={{ backgroundColor: c.secondary }}>
          <Row label="Subtotal" value={fmtAed(p.subtotal)} />
          <Row label="VAT" value={fmtAed(p.vatAmount)} />
          <Row label="Total" value={fmtAed(p.total)} bold />
        </Card>

        {p.paymentTerms ? <><SectionHeading title="Payment terms" /><Card><Text style={[styles.body, { color: c.foreground }]}>{p.paymentTerms}</Text></Card></> : null}
      </ScrollView>

      <ActionSheet
        visible={statusOpen} onClose={() => setStatusOpen(false)}
        title="Change status"
        actions={PI_STATUSES.map(s => ({ label: s.label, icon: "tag", onPress: () => changeStatus(s.value) }))}
      />
      <DocumentWebView visible={pdfOpen} onClose={() => setPdfOpen(false)} title={p.piNumber} html={proformaHtml(p)} />
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const c = useColors();
  return (
    <View style={styles.totalRow}>
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
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  grand: { fontFamily: "Inter_700Bold", fontSize: 16 },
});
