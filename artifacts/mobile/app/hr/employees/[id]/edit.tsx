import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useGetEmployee } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBlock, LoadingBlock } from "@/components/ui";
import { EmployeeForm } from "@/components/forms/EmployeeForm";
import { useApp } from "@/contexts/AppContext";
import { canManageHr } from "@/lib/permissions";

export default function EditEmployee() {
  const c = useColors();
  const { user } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!canManageHr(user)) return <Redirect href={{ pathname: "/hr/employees/[id]", params: { id: String(id) } }} />;
  const q = useGetEmployee(Number(id));

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Edit employee" subtitle={q.data?.employeeId} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? "Could not load employee"} onRetry={() => q.refetch()} /> : null}
        {q.data ? <EmployeeForm initial={q.data} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
});
