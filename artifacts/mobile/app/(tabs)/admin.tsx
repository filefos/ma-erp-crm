import React, { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useListCompanies, useListDepartments, useListUsers } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBlock, KpiGrid, KpiTile, QuickLink, SectionHeading, Skeleton } from "@/components/ui";

export default function AdminHub() {
  const c = useColors();
  const router = useRouter();
  const companies = useListCompanies();
  const departments = useListDepartments();
  const users = useListUsers();

  const refetchAll = () => { companies.refetch(); departments.refetch(); users.refetch(); };
  const loading = companies.isLoading || departments.isLoading || users.isLoading;
  const refreshing = companies.isRefetching || departments.isRefetching || users.isRefetching;
  const error = (companies.error ?? departments.error ?? users.error) as Error | null;

  const stats = useMemo(() => {
    const cs = companies.data ?? [];
    const ds = departments.data ?? [];
    const us = users.data ?? [];
    const activeCompanies = cs.filter(x => x.isActive).length;
    const activeUsers = us.filter(x => x.isActive).length;
    const adminUsers = us.filter(x => ["super_admin", "company_admin"].includes(x.permissionLevel ?? "")).length;
    return { companies: cs.length, activeCompanies, departments: ds.length, users: us.length, activeUsers, adminUsers };
  }, [companies.data, departments.data, users.data]);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Admin" subtitle="Companies · Departments · Users" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} tintColor={c.primary} />}
      >
        <SectionHeading title="Organisation" />
        {error && !loading ? (
          <ErrorBlock message={error.message ?? "Couldn't load admin data"} onRetry={refetchAll} />
        ) : null}
        {loading ? (
          <KpiGrid>
            <Skeleton height={84} /><Skeleton height={84} /><Skeleton height={84} /><Skeleton height={84} />
          </KpiGrid>
        ) : (
          <KpiGrid>
            <KpiTile label="Companies"     value={stats.companies}      icon="briefcase"  tone="navy"   hint={`${stats.activeCompanies} active`} />
            <KpiTile label="Departments"   value={stats.departments}    icon="grid"       tone="blue"   />
            <KpiTile label="Users"         value={stats.users}          icon="users"      tone="orange" hint={`${stats.activeUsers} active`} />
            <KpiTile label="Administrators" value={stats.adminUsers}    icon="shield"     tone="muted"  />
          </KpiGrid>
        )}

        <SectionHeading title="Manage" />
        <QuickLink icon="briefcase" label="Companies"   hint={`${stats.companies} registered`}    onPress={() => router.push("/admin/companies" as never)} />
        <QuickLink icon="grid"      label="Departments" hint={`${stats.departments} configured`}  onPress={() => router.push("/admin/departments" as never)} />
        <QuickLink icon="users"     label="Users"       hint={`${stats.users} accounts`}          onPress={() => router.push("/admin/users" as never)} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
});
