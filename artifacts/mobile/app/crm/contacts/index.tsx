import React, { useState } from "react";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { getListContactsQueryKey, useDeleteContact, useListContacts } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";

export default function ContactsList() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const params = search.trim() ? { search: search.trim() } : undefined;
  const q = useListContacts(params);

  const del = useDeleteContact({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListContactsQueryKey() }),
      onError: (e: unknown) => Alert.alert("Could not delete", (e as Error).message ?? ""),
    },
  });

  const data = q.data ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Contacts" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <BrandInput label="Search" icon="search" placeholder="Name, company, email…" value={search} onChangeText={setSearch} />
        <BrandButton label="New contact" icon="plus" onPress={() => router.push("/crm/contacts/new")} />

        {q.isLoading ? <LoadingBlock label="Loading contacts…" /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? "Unknown error"} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? (
          <EmptyState icon="user" title="No contacts" hint="Add your first contact to get started." />
        ) : null}

        {data.map(ct => (
          <Card key={ct.id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>{ct.name}</Text>
                <Text style={[styles.sub, { color: c.mutedForeground }]} numberOfLines={1}>
                  {[ct.designation, ct.companyName].filter(Boolean).join(" · ") || ct.email || "—"}
                </Text>
              </View>
              {ct.phone ? <IconBtn icon="phone" onPress={() => Linking.openURL(`tel:${ct.phone}`)} /> : null}
              {ct.email ? <IconBtn icon="mail" onPress={() => Linking.openURL(`mailto:${ct.email}`)} /> : null}
            </View>
            <View style={styles.row}>
              <BrandButton label="Edit" icon="edit-2" variant="secondary" onPress={() => router.push({ pathname: "/crm/contacts/[id]/edit", params: { id: String(ct.id) } })} style={{ flex: 1 }} />
              <BrandButton label="Delete" icon="trash-2" variant="ghost" onPress={() => Alert.alert("Delete contact?", ct.name, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => del.mutate({ id: ct.id }) },
              ])} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

function IconBtn({ icon, onPress }: { icon: "phone" | "mail"; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.iconBtn, { backgroundColor: c.secondary, opacity: pressed ? 0.85 : 1 }]}>
      <Feather name={icon} size={16} color={c.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  sub: { fontFamily: "Inter_500Medium", fontSize: 13 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
