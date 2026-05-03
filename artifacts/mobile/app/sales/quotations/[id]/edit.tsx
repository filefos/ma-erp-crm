import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useGetQuotation } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBlock, LoadingBlock } from "@/components/ui";
import { QuotationForm } from "@/components/forms/QuotationForm";

export default function EditQuotation() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useGetQuotation(Number(id));

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Edit quotation" subtitle={q.data?.quotationNumber} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {q.data ? <QuotationForm initial={q.data} /> : null}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
