import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { LeadForm } from "@/components/forms/LeadForm";

export default function NewLead() {
  const c = useColors();
  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="New lead" subtitle="Capture a fresh enquiry" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <LeadForm />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
});
