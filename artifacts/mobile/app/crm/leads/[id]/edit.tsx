import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useGetLead } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBlock, LoadingBlock } from "@/components/ui";
import { LeadForm } from "@/components/forms/LeadForm";

export default function EditLead() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useGetLead(Number(id));

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Edit lead" subtitle={q.data?.leadNumber} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? "Could not load lead"} onRetry={() => q.refetch()} /> : null}
        {q.data ? <LeadForm initial={q.data} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
});
