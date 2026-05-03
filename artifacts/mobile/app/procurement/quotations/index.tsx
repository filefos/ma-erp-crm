import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListSupplierQuotations } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { SQ_STATUSES, fmtAed, fmtDate, sqStatusMeta } from "@/lib/format";

export default function QuotationsList() {
  const c = useColors();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const q = useListSupplierQuotations(status ? { status } : undefined);
  const data = useMemo(() => {
    const list = q.data ?? [];
    const t = search.trim().toLowerCase();
    if (!t) return list;
    return list.filter(s => [s.sqNumber, s.supplierName, s.rfqNumber, s.supplierQuotationRef].filter(Boolean).some(v => String(v).toLowerCase().includes(t)));
  }, [q.data, search]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Supplier quotations" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <BrandInput label="Search" icon="search" value={search} onChangeText={setSearch} />
        <Select label="Status" value={status} options={[{ value: "", label: "All statuses" }, ...SQ_STATUSES]} onChange={setStatus} />
        <BrandButton label="New quotation" icon="plus" onPress={() => router.push("/procurement/quotations/new")} />

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="file-text" title="No quotations" hint="Capture quotations to compare suppliers." /> : null}

        {data.map(s => {
          const sm = sqStatusMeta(s.status);
          return (
            <Pressable key={s.id} onPress={() => router.push({ pathname: "/procurement/quotations/[id]", params: { id: String(s.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{s.sqNumber}</Text>
                  <StatusPill label={sm.label} tone={sm.tone} />
                </View>
                <Text style={[styles.body, { color: c.foreground }]} numberOfLines={1}>{s.supplierName}</Text>
                <View style={styles.row}>
                  {s.rfqNumber ? <Text style={[styles.meta, { color: c.mutedForeground }]}>{s.rfqNumber}</Text> : null}
                  {s.quotationDate ? <Text style={[styles.meta, { color: c.mutedForeground }]}>· {fmtDate(s.quotationDate)}</Text> : null}
                </View>
                <Text style={[styles.amount, { color: c.primary }]}>{fmtAed(s.total)}</Text>
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
