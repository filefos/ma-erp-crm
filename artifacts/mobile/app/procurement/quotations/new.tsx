import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { SqForm } from "@/components/forms/SqForm";

export default function NewQuotation() {
  const c = useColors();
  const { rfqId, supplierId } = useLocalSearchParams<{ rfqId?: string; supplierId?: string }>();
  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New supplier quotation" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SqForm sourceRfqId={rfqId ? Number(rfqId) : undefined} sourceSupplierId={supplierId ? Number(supplierId) : undefined} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
