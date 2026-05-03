import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { InventoryItemForm } from "@/components/forms/InventoryItemForm";

export default function NewItem() {
  const c = useColors();
  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New item" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <InventoryItemForm />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
