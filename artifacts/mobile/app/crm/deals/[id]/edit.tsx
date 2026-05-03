import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useListDeals } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBlock, LoadingBlock } from "@/components/ui";
import { DealForm } from "@/components/forms/DealForm";

export default function EditDeal() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useListDeals();
  const d = (q.data ?? []).find(x => x.id === Number(id)) ?? null;

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Edit deal" subtitle={d?.dealNumber} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {d ? <DealForm initial={d} /> : null}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
