import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useGetPurchaseRequest } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBlock, LoadingBlock } from "@/components/ui";
import { PrForm } from "@/components/forms/PrForm";

export default function EditPr() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useGetPurchaseRequest(Number(id));
  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Edit PR" subtitle={q.data?.prNumber} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {q.data ? <PrForm initial={q.data} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
