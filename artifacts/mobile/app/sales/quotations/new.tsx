import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { QuotationForm } from "@/components/forms/QuotationForm";

export default function NewQuotation() {
  const c = useColors();
  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New quotation" subtitle="Build a quote with line items" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <QuotationForm />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
