import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  useListPurchaseOrders, useListPurchaseRequests, useListRfqs, useListSuppliers,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { KpiGrid, KpiTile, QuickLink, SectionHeading, Skeleton } from "@/components/ui";
import { fmtAed } from "@/lib/format";

const num = (v: unknown) => Number(v ?? 0) || 0;

export default function ProcurementHub() {
  const c = useColors();
  const router = useRouter();
  const suppliers = useListSuppliers();
  const prs = useListPurchaseRequests();
  const rfqs = useListRfqs();
  const pos = useListPurchaseOrders();

  const refetchAll = () => {
    suppliers.refetch(); prs.refetch(); rfqs.refetch(); pos.refetch();
  };
  const loading = suppliers.isLoading || prs.isLoading || rfqs.isLoading || pos.isLoading;
  const refreshing = suppliers.isRefetching || prs.isRefetching || rfqs.isRefetching || pos.isRefetching;

  const openPRs = (prs.data ?? []).filter(r => ["draft", "submitted"].includes((r.status ?? "").toLowerCase())).length;
  const openRFQs = (rfqs.data ?? []).filter(r => ["draft", "sent", "quotation_received"].includes((r.status ?? "").toLowerCase())).length;
  const openPOs = (pos.data ?? []).filter(p => !["closed", "rejected"].includes((p.status ?? "").toLowerCase())).length;
  const poTotal = (pos.data ?? []).reduce((s, p) => s + num(p.total), 0);
  const activeSuppliers = (suppliers.data ?? []).filter(s => s.status !== "blocked").length;

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Procurement" subtitle="Suppliers · PRs · RFQs · POs" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} tintColor={c.primary} />}
      >
        <SectionHeading title="Pipeline" />
        {loading ? (
          <KpiGrid>
            <Skeleton height={84} /><Skeleton height={84} /><Skeleton height={84} /><Skeleton height={84} />
          </KpiGrid>
        ) : (
          <KpiGrid>
            <KpiTile label="Open PRs" value={openPRs} icon="clipboard" tone="navy" />
            <KpiTile label="Open RFQs" value={openRFQs} icon="send" tone="orange" />
            <KpiTile label="Open POs" value={openPOs} icon="shopping-cart" tone="blue" />
            <KpiTile label="PO total" value={fmtAed(poTotal)} icon="dollar-sign" tone="muted" />
          </KpiGrid>
        )}

        <SectionHeading title="Manage" />
        <QuickLink icon="briefcase" label="Suppliers" hint={`${activeSuppliers} active`} onPress={() => router.push("/procurement/suppliers")} />
        <QuickLink icon="clipboard" label="Purchase requests" hint={`${(prs.data ?? []).length} total`} onPress={() => router.push("/procurement/prs")} />
        <QuickLink icon="send" label="RFQs" hint={`${(rfqs.data ?? []).length} total`} onPress={() => router.push("/procurement/rfqs")} />
        <QuickLink icon="file-text" label="Supplier quotations" onPress={() => router.push("/procurement/quotations")} />
        <QuickLink icon="shopping-cart" label="Purchase orders" hint={`${(pos.data ?? []).length} total`} onPress={() => router.push("/procurement/pos")} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
});
