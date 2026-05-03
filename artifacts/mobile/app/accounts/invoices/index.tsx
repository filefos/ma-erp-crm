import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListTaxInvoices } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { PAYMENT_STATUSES, fmtAed, fmtDate, num, paymentStatusMeta } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

export default function InvoicesList() {
  const c = useColors();
  const router = useRouter();
  const { activeCompanyId } = useApp();
  const [status, setStatus] = useState("");
  const q = useListTaxInvoices({ companyId: activeCompanyId ?? undefined, ...(status ? { status } : {}) });
  const data = useMemo(
    () => (q.data ?? []).filter(i => activeCompanyId == null || i.companyId === activeCompanyId),
    [q.data, activeCompanyId],
  );

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Tax invoices" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Select label="Payment status" value={status} options={[{ value: "", label: "All statuses" }, ...PAYMENT_STATUSES]} onChange={setStatus} />
        <BrandButton label="New invoice" icon="plus" onPress={() => router.push("/accounts/invoices/new")} />

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="file-text" title="No invoices" hint="Create your first tax invoice." /> : null}

        {data.map(i => {
          const sm = paymentStatusMeta(i.paymentStatus);
          const balance = num(i.grandTotal) - num(i.amountPaid);
          return (
            <Pressable key={i.id} onPress={() => router.push({ pathname: "/accounts/invoices/[id]", params: { id: String(i.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{i.invoiceNumber}</Text>
                  <StatusPill label={sm.label} tone={sm.tone} />
                </View>
                <Text style={[styles.body, { color: c.foreground }]} numberOfLines={1}>{i.clientName}</Text>
                <View style={styles.row}>
                  <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(i.grandTotal)}</Text>
                  {balance > 0 ? <Text style={[styles.meta, { color: c.accent }]}>· Balance {fmtAed(balance)}</Text> : null}
                  {i.invoiceDate ? <Text style={[styles.meta, { color: c.mutedForeground }]}>· {fmtDate(i.invoiceDate)}</Text> : null}
                </View>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 15 },
});
