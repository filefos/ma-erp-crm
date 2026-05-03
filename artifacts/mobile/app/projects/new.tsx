import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { ProjectForm } from "@/components/forms/ProjectForm";
import { useApp } from "@/contexts/AppContext";
import { canManageProjects } from "@/lib/permissions";

export default function NewProject() {
  const c = useColors();
  const { user } = useApp();
  if (!canManageProjects(user)) return <Redirect href="/projects/list" />;
  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New project" subtitle="Capture project details" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ProjectForm />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
});
