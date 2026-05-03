import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { StockEntryForm } from "@/components/forms/StockEntryForm";

export default function NewStockEntry() {
  const c = useColors();
  const { itemId, type } = useLocalSearchParams<{ itemId?: string; type?: string }>();
  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New stock entry" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <StockEntryForm initialItemId={itemId ? Number(itemId) : undefined} initialType={type ?? undefined} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
