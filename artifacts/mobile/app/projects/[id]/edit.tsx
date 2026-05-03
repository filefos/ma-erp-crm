import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useGetProject } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBlock, LoadingBlock } from "@/components/ui";
import { ProjectForm } from "@/components/forms/ProjectForm";
import { useApp } from "@/contexts/AppContext";
import { canManageProjects } from "@/lib/permissions";

export default function EditProject() {
  const c = useColors();
  const { user } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!canManageProjects(user)) return <Redirect href={{ pathname: "/projects/[id]", params: { id: String(id) } }} />;
  const q = useGetProject(Number(id));

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Edit project" subtitle={q.data?.projectNumber} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? "Could not load"} onRetry={() => q.refetch()} /> : null}
        {q.data ? <ProjectForm initial={q.data} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
});
