import React from "react";
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGetSupplier } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { supplierStatusMeta } from "@/lib/format";

export default function SupplierDetail() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sid = Number(id);
  const q = useGetSupplier(sid);

  if (q.isLoading) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Supplier" /><LoadingBlock /></View>;
  if (q.error || !q.data) return <View style={[styles.flex, { backgroundColor: c.background }]}><AppHeader title="Supplier" /><ErrorBlock message={(q.error as Error)?.message ?? "Not found"} onRetry={() => q.refetch()} /></View>;

  const s = q.data;
  const sm = supplierStatusMeta(s.status);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={s.name} subtitle={s.category ?? "Supplier"} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={sm.label} tone={sm.tone} />
            {s.trn ? <Text style={[styles.meta, { color: c.mutedForeground }]}>TRN {s.trn}</Text> : null}
          </View>
          {s.contactPerson ? <Text style={[styles.body, { color: c.foreground }]}>{s.contactPerson}</Text> : null}
        </Card>

        <View style={styles.row}>
          <BrandButton label="Edit" icon="edit-3" onPress={() => router.push({ pathname: "/procurement/suppliers/[id]/edit", params: { id: String(sid) } })} style={{ flex: 1 }} />
          <BrandButton label="New PO" variant="secondary" icon="shopping-cart" onPress={() => router.push({ pathname: "/procurement/pos/new", params: { supplierId: String(sid) } })} style={{ flex: 1 }} />
        </View>

        <SectionHeading title="Contact" />
        <Card>
          {s.email ? <Text style={[styles.body, { color: c.primary }]} onPress={() => Linking.openURL(`mailto:${s.email}`)}>{s.email}</Text> : null}
          {s.phone ? <Text style={[styles.body, { color: c.primary }]} onPress={() => Linking.openURL(`tel:${s.phone}`)}>{s.phone}</Text> : null}
          {s.whatsapp ? <Text style={[styles.body, { color: c.primary }]} onPress={() => Linking.openURL(`https://wa.me/${s.whatsapp?.replace(/\D/g, "")}`)}>WhatsApp · {s.whatsapp}</Text> : null}
          {s.website ? <Text style={[styles.body, { color: c.primary }]} onPress={() => Linking.openURL(s.website ?? "")}>{s.website}</Text> : null}
          {s.address ? <Text style={[styles.body, { color: c.foreground, marginTop: 6 }]}>{s.address}</Text> : null}
        </Card>

        {(s.bankName || s.iban || s.bankAccountNumber) ? (
          <>
            <SectionHeading title="Banking" />
            <Card>
              {s.bankName ? <Text style={[styles.body, { color: c.foreground }]}>{s.bankName}</Text> : null}
              {s.bankAccountName ? <Text style={[styles.meta, { color: c.mutedForeground }]}>{s.bankAccountName}</Text> : null}
              {s.bankAccountNumber ? <Text style={[styles.meta, { color: c.mutedForeground }]}>A/C {s.bankAccountNumber}</Text> : null}
              {s.iban ? <Text style={[styles.meta, { color: c.mutedForeground }]}>IBAN {s.iban}</Text> : null}
            </Card>
          </>
        ) : null}

        {s.paymentTerms ? <><SectionHeading title="Payment terms" /><Card><Text style={[styles.body, { color: c.foreground }]}>{s.paymentTerms}</Text></Card></> : null}
        {s.notes ? <><SectionHeading title="Notes" /><Card><Text style={[styles.body, { color: c.foreground }]}>{s.notes}</Text></Card></> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginVertical: 2 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
});
