import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useListDepartments, useListEmployees } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, BrandInput, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { EMPLOYEE_TYPES, employeeTypeMeta } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";
import { canManageHr } from "@/lib/permissions";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function EmployeesList() {
  const c = useColors();
  const router = useRouter();
  const { activeCompanyId, user } = useApp();
  const canManage = canManageHr(user);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const departmentsQ = useListDepartments();
  const departmentOptions = useMemo(() => {
    const opts = (departmentsQ.data ?? []).filter(d => d.isActive !== false).map(d => ({ value: String(d.id), label: d.name }));
    return [{ value: "", label: "All departments" }, ...opts];
  }, [departmentsQ.data]);

  const params = {
    ...(activeCompanyId ? { companyId: activeCompanyId } : {}),
    ...(type ? { type } : {}),
    ...(departmentId ? { departmentId: Number(departmentId) } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  };
  const q = useListEmployees(params);
  const data = useMemo(() => {
    const list = q.data ?? [];
    if (!status) return list;
    return list.filter(e => (status === "active" ? e.isActive : !e.isActive));
  }, [q.data, status]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Employees" subtitle={`${data.length} record${data.length === 1 ? "" : "s"}`} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
      >
        <BrandInput label="Search" icon="search" placeholder="Name, employee ID…" value={search} onChangeText={setSearch} />
        <Select label="Type" value={type} options={[{ value: "", label: "All types" }, ...EMPLOYEE_TYPES]} onChange={setType} />
        <Select label="Department" icon="briefcase" value={departmentId} options={departmentOptions} onChange={setDepartmentId} />
        <Select label="Status" icon="activity" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        {canManage ? (
          <BrandButton label="New employee" icon="user-plus" onPress={() => router.push("/hr/employees/new")} />
        ) : null}

        {q.isLoading ? <LoadingBlock label="Loading employees…" /> : null}
        {q.error ? <ErrorBlock message={(q.error as Error).message ?? "Unknown error"} onRetry={() => q.refetch()} /> : null}
        {!q.isLoading && data.length === 0 ? (
          <EmptyState icon="users" title="No employees" hint="Add your first team member to get started." />
        ) : null}

        {data.map(e => {
          const tm = employeeTypeMeta(e.type);
          return (
            <Pressable key={e.id} onPress={() => router.push({ pathname: "/hr/employees/[id]", params: { id: String(e.id) } })}>
              <Card>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{e.name}</Text>
                  <StatusPill label={tm.label} tone={tm.tone} />
                </View>
                <View style={styles.row}>
                  <Text style={[styles.sub, { color: c.mutedForeground, flex: 1 }]} numberOfLines={1}>
                    {e.designation ?? "—"} · {e.employeeId}
                  </Text>
                  {e.isActive ? null : <StatusPill label="Inactive" tone="muted" />}
                </View>
                <View style={styles.row}>
                  {e.departmentName ? <Meta icon="briefcase" text={e.departmentName} /> : null}
                  {e.siteLocation ? <Meta icon="map-pin" text={e.siteLocation} /> : null}
                  {e.nationality ? <Meta icon="flag" text={e.nationality} /> : null}
                </View>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Meta({ icon, text }: { icon: React.ComponentProps<typeof Feather>["name"]; text: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Feather name={icon} size={11} color={c.mutedForeground} />
      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: c.mutedForeground }} numberOfLines={1}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  sub: { fontFamily: "Inter_500Medium", fontSize: 13 },
});
