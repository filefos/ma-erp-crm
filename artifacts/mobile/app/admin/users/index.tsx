import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListUsers } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandInput, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { StatusPill } from "@/components/forms";

export default function UsersList() {
  const c = useColors();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const q = useListUsers();
  const data = q.data ?? [];

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data;
    return data.filter(u =>
      [u.name, u.email, u.role, u.departmentName, u.companyName].some(v => (v ?? "").toLowerCase().includes(s)),
    );
  }, [data, search]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Users" subtitle={`${data.length} account${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <BrandInput label="Search" icon="search" placeholder="Name, email, role…" value={search} onChangeText={setSearch} />

        {q.isLoading ? <LoadingBlock label="Loading users…" /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? "Unknown error"} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && filtered.length === 0 ? (
          <EmptyState icon="users" title="No users" hint={search ? "Try a different search." : "No accounts are configured."} />
        ) : null}

        {filtered.map(u => {
          const isAdmin = ["super_admin", "company_admin"].includes(u.permissionLevel ?? "");
          return (
            <Pressable key={u.id} onPress={() => router.push({ pathname: "/admin/users/[id]" as never, params: { id: String(u.id) } } as never)}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{u.name}</Text>
                  <StatusPill label={u.isActive ? "Active" : "Inactive"} tone={u.isActive ? "success" : "muted"} />
                </View>
                <Text style={[styles.sub, { color: c.mutedForeground }]} numberOfLines={1}>{u.email}</Text>
                <View style={styles.row}>
                  <StatusPill label={(u.role ?? "user").replace(/_/g, " ")} tone="blue" />
                  {isAdmin ? <StatusPill label={(u.permissionLevel ?? "").replace(/_/g, " ")} tone="navy" /> : null}
                  {u.departmentName ? (
                    <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={1}>{u.departmentName}</Text>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  sub: { fontFamily: "Inter_500Medium", fontSize: 13 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
});
