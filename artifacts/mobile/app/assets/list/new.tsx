import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { AssetForm } from "@/components/forms/AssetForm";

export default function NewAsset() {
  const c = useColors();
  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New asset" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AssetForm />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
