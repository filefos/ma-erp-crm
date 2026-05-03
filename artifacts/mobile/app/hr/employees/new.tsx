import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { EmployeeForm } from "@/components/forms/EmployeeForm";
import { useApp } from "@/contexts/AppContext";
import { canManageHr } from "@/lib/permissions";

export default function NewEmployee() {
  const c = useColors();
  const { user } = useApp();
  if (!canManageHr(user)) return <Redirect href="/hr/employees" />;
  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New employee" subtitle="Add a staff member or labour" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <EmployeeForm />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
});
