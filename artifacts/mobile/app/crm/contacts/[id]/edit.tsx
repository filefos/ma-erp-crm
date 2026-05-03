import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useListContacts } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBlock, LoadingBlock } from "@/components/ui";
import { ContactForm } from "@/components/forms/ContactForm";

export default function EditContact() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useListContacts();
  const ct = (q.data ?? []).find(x => x.id === Number(id)) ?? null;

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Edit contact" subtitle={ct?.name} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {q.isLoading ? <LoadingBlock /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? ""} onRetry={() => q.refetch()} /> : null}
        {ct ? <ContactForm initial={ct} /> : null}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 16, gap: 12, paddingBottom: 120 } });
