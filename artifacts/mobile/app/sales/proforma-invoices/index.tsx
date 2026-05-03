import React, { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListProformaInvoices } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { PI_STATUSES, fmtAed, fmtDate, piStatusMeta } from "@/lib/format";

export default function PiList() {
  const c = useColors();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const params = status ? { status } : undefined;
  const q = useListProformaInvoices(params);
  const data = q.data ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Proforma invoices" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Select label="Status" value={status} options={[{ value: "", label: "All statuses" }, ...PI_STATUSES]} onChange={setStatus} />
        <BrandButton label="New proforma" icon="plus" onPress={() => router.push("/sales/proforma-invoices/new")} />

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="file" title="No proforma invoices" /> : null}

        {data.map(p => {
          const sm = piStatusMeta(p.status);
          return (
            <Pressable key={p.id} onPress={() => router.push({ pathname: "/sales/proforma-invoices/[id]", params: { id: String(p.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{p.piNumber}</Text>
                  <StatusPill label={sm.label} tone={sm.tone} />
                </View>
                <Text style={[styles.body, { color: c.foreground }]} numberOfLines={1}>{p.clientName}</Text>
                {p.projectName ? <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={1}>{p.projectName}</Text> : null}
                <View style={styles.row}>
                  <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(p.total)}</Text>
                  <Text style={[styles.meta, { color: c.mutedForeground }]}>· {fmtDate(p.createdAt)}</Text>
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
