import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useGetPurchaseOrder } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBlock, LoadingBlock } from "@/components/ui";
import { PoForm } from "@/components/forms/PoForm";

export default function EditPo() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useGetPurchaseOrder(Number(id));
  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Edit PO" subtitle={q.data?.poNumber} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {q.data ? <PoForm initial={q.data} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
