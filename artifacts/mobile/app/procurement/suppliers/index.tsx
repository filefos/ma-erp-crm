import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListSuppliers } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { SUPPLIER_STATUSES, supplierStatusMeta } from "@/lib/format";

export default function SuppliersList() {
  const c = useColors();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const q = useListSuppliers();
  const data = useMemo(() => {
    const list = q.data ?? [];
    const t = search.trim().toLowerCase();
    return list.filter(s => {
      if (status && s.status !== status) return false;
      if (!t) return true;
      return [s.name, s.contactPerson, s.email, s.phone, s.category].filter(Boolean).some(v => String(v).toLowerCase().includes(t));
    });
  }, [q.data, status, search]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Suppliers" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <BrandInput label="Search" icon="search" value={search} onChangeText={setSearch} />
        <Select label="Status" value={status} options={[{ value: "", label: "All statuses" }, ...SUPPLIER_STATUSES]} onChange={setStatus} />
        <BrandButton label="New supplier" icon="plus" onPress={() => router.push("/procurement/suppliers/new")} />

        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="briefcase" title="No suppliers" hint="Add your first supplier to start raising RFQs." /> : null}

        {data.map(s => {
          const sm = supplierStatusMeta(s.status);
          return (
            <Pressable key={s.id} onPress={() => router.push({ pathname: "/procurement/suppliers/[id]", params: { id: String(s.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{s.name}</Text>
                  <StatusPill label={sm.label} tone={sm.tone} />
                </View>
                {s.contactPerson ? <Text style={[styles.body, { color: c.foreground }]} numberOfLines={1}>{s.contactPerson}</Text> : null}
                <View style={styles.row}>
                  {s.category ? <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={1}>{s.category}</Text> : null}
                  {s.phone ? <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={1}>· {s.phone}</Text> : null}
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
});
