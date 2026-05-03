import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useListDepartments, useListUsers } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { Card, EmptyState, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
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

export default function DepartmentDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const deptId = Number(id);
  const list = useListDepartments();
  const users = useListUsers({ departmentId: deptId });

  const dept = useMemo(
    () => (list.data ?? []).find(d => d.id === deptId),
    [list.data, deptId],
  );

  if (list.isLoading) {
    return (
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <AppHeader title="Department" />
        <LoadingBlock label="Loading department…" />
      </View>
    );
  }
  if (list.error || !dept) {
    return (
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <AppHeader title="Department" />
        <ErrorBlock message={(list.error as Error)?.message ?? "Department not found"} onRetry={() => list.refetch()} />
      </View>
    );
  }

  const members = users.data ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={dept.name} subtitle={dept.description ?? undefined} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.row}>
            <Text style={[styles.title, { color: c.foreground, flex: 1 }]}>{dept.name}</Text>
            <StatusPill label={dept.isActive ? "Active" : "Inactive"} tone={dept.isActive ? "success" : "muted"} />
          </View>
          <Field label="Description" value={dept.description} />
          <Field label="Created" value={fmtDate(dept.createdAt)} />
        </Card>

        <SectionHeading title={`Members (${members.length})`} />
        {users.isLoading ? <LoadingBlock label="Loading members…" /> : null}
        {users.error ? <ErrorBlock message={(users.error as Error).message ?? "Unknown error"} onRetry={() => users.refetch()} /> : null}
        {!users.isLoading && members.length === 0 ? (
          <EmptyState icon="users" title="No members" hint="No users are assigned to this department." />
        ) : null}
        {members.map(u => (
          <Card key={u.id}>
            <View style={styles.row}>
              <Text style={[styles.value, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{u.name}</Text>
              <StatusPill label={u.isActive ? "Active" : "Inactive"} tone={u.isActive ? "success" : "muted"} />
            </View>
            <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={1}>{u.email}</Text>
            <View style={styles.row}>
              <StatusPill label={(u.role ?? "user").replace(/_/g, " ")} tone="blue" />
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { fontFamily: "Inter_700Bold", fontSize: 17 },
  label: { fontFamily: "Inter_500Medium", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
});
