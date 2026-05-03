import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListProjects } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { PROJECT_STAGES, fmtAed, projectStageMeta } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";
import { canManageProjects } from "@/lib/permissions";

export default function ProjectsList() {
  const c = useColors();
  const router = useRouter();
  const { activeCompanyId, user } = useApp();
  const canManage = canManageProjects(user);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>("");

  const params = {
    ...(activeCompanyId ? { companyId: activeCompanyId } : {}),
    ...(stage ? { stage } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  };
  const q = useListProjects(params);
  const data = useMemo(() => q.data ?? [], [q.data]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Projects" subtitle={`${data.length} project${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <BrandInput label="Search" icon="search" placeholder="Project number, name, client…" value={search} onChangeText={setSearch} />
        <Select label="Stage" value={stage} options={[{ value: "", label: "All stages" }, ...PROJECT_STAGES]} onChange={setStage} />
        {canManage ? (
          <BrandButton label="New project" icon="plus" onPress={() => router.push("/projects/new")} />
        ) : null}

        {q.isLoading ? <LoadingBlock label="Loading projects…" /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? "Error"} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? <EmptyState icon="folder" title="No projects" hint="Create your first project to start tracking." /> : null}

        {data.map(p => {
          const sm = projectStageMeta(p.stage);
          return (
            <Pressable key={p.id} onPress={() => router.push({ pathname: "/projects/[id]", params: { id: String(p.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{p.projectName}</Text>
                  <StatusPill label={sm.label} tone={sm.tone} />
                </View>
                <View style={styles.row}>
                  <Text style={[styles.sub, { color: c.mutedForeground, flex: 1 }]} numberOfLines={1}>
                    {p.projectNumber} · {p.clientName}
                  </Text>
                  <Text style={[styles.sub, { color: c.foreground }]}>{fmtAed(p.projectValue ?? 0)}</Text>
                </View>
                <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={1}>
                  {p.location ? `📍 ${p.location} · ` : ""}
                  {p.salespersonName ?? "Unassigned"}
                </Text>
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
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  sub: { fontFamily: "Inter_500Medium", fontSize: 13 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
});
