import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { RfqForm } from "@/components/forms/RfqForm";

export default function NewRfq() {
  const c = useColors();
  const { prId } = useLocalSearchParams<{ prId?: string }>();
  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New RFQ" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <RfqForm sourcePrId={prId ? Number(prId) : undefined} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
