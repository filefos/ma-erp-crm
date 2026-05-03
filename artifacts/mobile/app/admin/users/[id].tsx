import React from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useGetUser } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { fmtDate, fmtRelative } from "@/lib/format";

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

export default function UserDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);
  const q = useGetUser(userId);

  if (q.isLoading) {
    return (
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <AppHeader title="User" />
        <LoadingBlock label="Loading user…" />
      </View>
    );
  }
  if (q.error || !q.data) {
    return (
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <AppHeader title="User" />
        <ErrorBlock message={(q.error as Error)?.message ?? "User not found"} onRetry={() => q.refetch()} />
      </View>
    );
  }
  const u = q.data;
  const isAdmin = ["super_admin", "company_admin"].includes(u.permissionLevel ?? "");

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={u.name} subtitle={u.email} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.row}>
            <Text style={[styles.title, { color: c.foreground, flex: 1 }]}>{u.name}</Text>
            <StatusPill label={u.isActive ? "Active" : "Inactive"} tone={u.isActive ? "success" : "muted"} />
          </View>
          <View style={styles.row}>
            <StatusPill label={(u.role ?? "user").replace(/_/g, " ")} tone="blue" />
            {isAdmin ? <StatusPill label={(u.permissionLevel ?? "").replace(/_/g, " ")} tone="navy" /> : null}
          </View>
          <Field label="Email" value={u.email} />
          <Field label="Phone" value={u.phone} />
          {u.email ? <BrandButton label="Email" icon="mail" variant="secondary" onPress={() => Linking.openURL(`mailto:${u.email}`)} /> : null}
          {u.phone ? <BrandButton label="Call" icon="phone" variant="secondary" onPress={() => Linking.openURL(`tel:${u.phone}`)} /> : null}
        </Card>

        <SectionHeading title="Organisation" />
        <Card>
          <Field label="Company" value={u.companyName} />
          <Field label="Department" value={u.departmentName} />
          <Field label="Permission level" value={u.permissionLevel} />
          <Field label="Status" value={u.status} />
        </Card>

        <SectionHeading title="Activity" />
        <Card>
          <Field label="Last login" value={u.lastLoginAt ? fmtRelative(u.lastLoginAt) : "Never"} />
          <Field label="Created" value={fmtDate(u.createdAt)} />
        </Card>

        {u.accessibleCompanies && u.accessibleCompanies.length > 0 ? (
          <>
            <SectionHeading title="Company access" />
            <Card>
              {u.accessibleCompanies.map(co => (
                <View key={co.id} style={styles.accessRow}>
                  <Text style={[styles.value, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{co.name}</Text>
                  {co.shortName ? <Text style={[styles.meta, { color: c.mutedForeground }]}>{co.shortName}</Text> : null}
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  accessRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 17 },
  label: { fontFamily: "Inter_500Medium", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
});
