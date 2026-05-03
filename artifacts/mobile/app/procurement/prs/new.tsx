import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { PrForm } from "@/components/forms/PrForm";

export default function NewPr() {
  const c = useColors();
  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New purchase request" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PrForm />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
