import React from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGetEmployee, useListAttendance } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, EmptyState, ErrorBlock, LoadingBlock, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { attendanceStatusMeta, employeeTypeMeta, fmtDate } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";
import { canManageHr } from "@/lib/permissions";

export default function EmployeeDetail() {
  const c = useColors();
  const router = useRouter();
  const { user } = useApp();
  const canManage = canManageHr(user);
  const { id } = useLocalSearchParams<{ id: string }>();
  const employeeId = Number(id);
  const employee = useGetEmployee(employeeId);
  const attendance = useListAttendance({ employeeId });

  if (employee.isLoading) {
    return (
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <AppHeader title="Employee" />
        <LoadingBlock label="Loading employee…" />
      </View>
    );
  }
  if (employee.error || !employee.data) {
    return (
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        <AppHeader title="Employee" />
        <ErrorBlock message={(employee.error as Error)?.message ?? "Employee not found"} onRetry={() => employee.refetch()} />
      </View>
    );
  }

  const e = employee.data;
  const tm = employeeTypeMeta(e.type);
  const recent = (attendance.data ?? [])
    .slice()
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 14);

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title={e.name} subtitle={e.employeeId} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={employee.isRefetching} onRefresh={() => { employee.refetch(); attendance.refetch(); }} tintColor={c.primary} />}
      >
        <Card>
          <View style={styles.row}>
            <StatusPill label={tm.label} tone={tm.tone} />
            <StatusPill label={e.isActive ? "Active" : "Inactive"} tone={e.isActive ? "success" : "muted"} />
          </View>
          {e.designation ? <Text style={[styles.body, { color: c.foreground }]}>{e.designation}</Text> : null}
          {e.departmentName ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Department: {e.departmentName}</Text> : null}
          {e.nationality ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Nationality: {e.nationality}</Text> : null}
          {e.siteLocation ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Site: {e.siteLocation}</Text> : null}
          {e.joiningDate ? <Text style={[styles.meta, { color: c.mutedForeground }]}>Joined: {fmtDate(e.joiningDate)}</Text> : null}
        </Card>

        <View style={styles.row}>
          {e.phone ? <ContactIcon icon="phone" onPress={() => Linking.openURL(`tel:${e.phone}`)} /> : null}
          {e.phone ? <ContactIcon icon="message-circle" onPress={() => Linking.openURL(`https://wa.me/${(e.phone ?? "").replace(/\D/g, "")}`)} /> : null}
          {e.email ? <ContactIcon icon="mail" onPress={() => Linking.openURL(`mailto:${e.email}`)} /> : null}
        </View>

        {canManage ? (
          <BrandButton label="Edit" icon="edit-2" onPress={() => router.push({ pathname: "/hr/employees/[id]/edit", params: { id: String(employeeId) } })} />
        ) : null}

        <SectionHeading title={`Recent attendance (${recent.length})`} action={
          <Pressable onPress={() => router.push("/hr/attendance")}>
            <Text style={{ color: c.primary, fontFamily: "Inter_600SemiBold" }}>All</Text>
          </Pressable>
        } />
        {attendance.isLoading ? <LoadingBlock /> : null}
        {!attendance.isLoading && recent.length === 0 ? (
          <EmptyState icon="calendar" title="No attendance records" hint="Records will appear once attendance is logged." />
        ) : null}
        {recent.map(a => {
          const sm = attendanceStatusMeta(a.status);
          return (
            <Card key={a.id}>
              <View style={styles.row}>
                <Text style={[styles.body, { color: c.foreground, flex: 1 }]}>{a.date}</Text>
                <StatusPill label={sm.label} tone={sm.tone} />
              </View>
              <Text style={[styles.meta, { color: c.mutedForeground }]}>
                {a.checkIn ? `In ${a.checkIn}` : "—"}
                {a.checkOut ? ` · Out ${a.checkOut}` : ""}
                {a.overtime ? ` · OT ${a.overtime}h` : ""}
              </Text>
              {a.notes ? <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={2}>{a.notes}</Text> : null}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ContactIcon({ icon, onPress }: { icon: "phone" | "message-circle" | "mail"; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.iconBtn, { backgroundColor: c.secondary, opacity: pressed ? 0.85 : 1 }]}>
      <Feather name={icon} size={18} color={c.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  body: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
