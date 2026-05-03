import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { SupplierForm } from "@/components/forms/SupplierForm";

export default function NewSupplier() {
  const c = useColors();
  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New supplier" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SupplierForm />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
