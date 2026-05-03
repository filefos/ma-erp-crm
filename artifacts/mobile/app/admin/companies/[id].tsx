import React from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useGetCompany } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { fmtDate } from "@/lib/format";

function Field({ label, value }: { label: string; value?: string | number | null }) {
  const c = useColors();
  if (value == null || value === "") return null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={[styles.label, { color: c.mutedForeground }]}>{label}</Text>
      <Text style={[styles.value, { color: c.foreground }]}>{String(value)}</Text>
    </View>
  );
}

export default function CompanyDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const companyId = Number(id);
  const q = useGetCompany(companyId);

  if (q.isLoading) {
    return (
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <AppHeader title="Company" />
        <LoadingBlock label="Loading company…" />
      </View>
    );
  }
  if (q.error || !q.data) {
    return (
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <AppHeader title="Company" />
        <ErrorBlock message={(q.error as Error)?.message ?? "Company not found"} onRetry={() => q.refetch()} />
      </View>
    );
  }
  const co = q.data;

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={co.name} subtitle={co.shortName} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.row}>
            <Text style={[styles.title, { color: c.foreground, flex: 1 }]}>{co.name}</Text>
            <StatusPill label={co.isActive ? "Active" : "Inactive"} tone={co.isActive ? "success" : "muted"} />
          </View>
          <Field label="Prefix" value={co.prefix} />
          <Field label="TRN" value={co.trn} />
          <Field label="VAT %" value={co.vatPercent} />
          <Field label="Created" value={fmtDate(co.createdAt)} />
        </Card>

        <SectionHeading title="Contact" />
        <Card>
          <Field label="Email" value={co.email} />
          <Field label="Phone" value={co.phone} />
          <Field label="Website" value={co.website} />
          <Field label="Address" value={co.address} />
          {co.phone ? <BrandButton label="Call" icon="phone" variant="secondary" onPress={() => Linking.openURL(`tel:${co.phone}`)} /> : null}
          {co.email ? <BrandButton label="Email" icon="mail" variant="secondary" onPress={() => Linking.openURL(`mailto:${co.email}`)} /> : null}
        </Card>

        {co.bankDetails ? (
          <>
            <SectionHeading title="Bank details" />
            <Card><Text style={[styles.body, { color: c.foreground }]}>{co.bankDetails}</Text></Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 17 },
  label: { fontFamily: "Inter_500Medium", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  body: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
});
