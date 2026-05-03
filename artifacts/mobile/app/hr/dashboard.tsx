import React, { useMemo } from "react";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { useListAttendance, useListEmployees } from "@workspace/api-client-react";
import { DashboardScreen } from "@/components/Dashboard";
import { Card, EmptyState, KpiGrid, KpiTile, QuickLink, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { attendanceStatusMeta } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function HrDashboard() {
  const router = useRouter();
  const { activeCompanyId } = useApp();
  const employees = useListEmployees(activeCompanyId ? { companyId: activeCompanyId } : {});
  const attendance = useListAttendance({});

  const empList = useMemo(() => employees.data ?? [], [employees.data]);
  const empIds = useMemo(() => new Set(empList.map(e => e.id)), [empList]);
  const records = useMemo(() => (attendance.data ?? []).filter(a => empIds.has(a.employeeId)), [attendance.data, empIds]);

  const today = todayKey();
  const totalActive = empList.filter(e => e.isActive !== false).length;
  const labour = empList.filter(e => (e.type ?? "").toLowerCase() === "labor").length;
  const staff = empList.filter(e => (e.type ?? "").toLowerCase() === "staff").length;
  const presentToday = records.filter(r => r.date === today && r.status === "present").length;
  const absentToday = records.filter(r => r.date === today && r.status === "absent").length;
  const overtimeToday = records.filter(r => r.date === today).reduce((s, r) => s + Number(r.overtime ?? 0), 0);
  const onLeaveToday = records.filter(r => r.date === today && r.status === "leave").length;
  const attendancePct = totalActive > 0 ? Math.round((presentToday / totalActive) * 100) : 0;

  const newJoinersThisMonth = useMemo(() => {
    const monthStart = new Date(); monthStart.setDate(1);
    return empList.filter(e => e.joiningDate && new Date(e.joiningDate) >= monthStart).length;
  }, [empList]);

  const departmentMix = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of empList) {
      const k = e.departmentName ?? "Unassigned";
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [empList]);

  const nationalityMix = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of empList) {
      const k = e.nationality ?? "—";
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [empList]);

  const recent = useMemo(() => records
    .slice()
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || (b.checkIn ?? "").localeCompare(a.checkIn ?? ""))
    .slice(0, 8)
    .map(r => ({ ...r, name: empList.find(e => e.id === r.employeeId)?.name ?? `#${r.employeeId}` })),
  [records, empList]);

  return (
    <DashboardScreen title="HR Dashboard" subtitle="Workforce, attendance and demographics">
      <SectionHeading title="Today" />
      <KpiGrid>
        <KpiTile label="Workforce" value={totalActive} icon="users" tone="navy" hint={`${labour} labour · ${staff} staff`} />
        <KpiTile label="Present" value={presentToday} icon="check-circle" tone="blue" hint={`${attendancePct}% attendance`} />
        <KpiTile label="Absent" value={absentToday} icon="x-circle" tone="orange" hint={`${onLeaveToday} on leave`} />
        <KpiTile label="Overtime" value={overtimeToday.toFixed(1)} icon="clock" tone="muted" hint="Hours today" />
      </KpiGrid>

      <SectionHeading title="Quick actions" />
      <QuickLink icon="users" label="Employees" hint={`${empList.length} on file`} onPress={() => router.push("/hr/employees")} />
      <QuickLink icon="check-square" label="Attendance" hint="Mark today, view history" onPress={() => router.push("/hr/attendance")} />
      <QuickLink icon="user-plus" label="New joiners" hint={`${newJoinersThisMonth} this month`} onPress={() => router.push("/hr/employees")} />

      {departmentMix.length > 0 ? (
        <>
          <SectionHeading title="Department mix" />
          <Card>
            {departmentMix.map(d => (
              <View key={d.name} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 4 }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, flex: 1 }} numberOfLines={1}>{d.name}</Text>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13 }}>{d.value}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {nationalityMix.length > 0 ? (
        <>
          <SectionHeading title="Nationality" />
          <Card>
            {nationalityMix.map(n => (
              <View key={n.name} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 4 }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, flex: 1 }} numberOfLines={1}>{n.name}</Text>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13 }}>{n.value}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeading title="Recent attendance" />
      {recent.length === 0 ? <EmptyState icon="calendar" title="No records yet" /> : null}
      {recent.map(r => {
        const sm = attendanceStatusMeta(r.status);
        return (
          <Card key={r.id}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 }} numberOfLines={1}>{r.name}</Text>
              <StatusPill label={sm.label} tone={sm.tone} />
            </View>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, marginTop: 2, color: "#64748b" }}>
              {r.date}{r.checkIn ? ` · in ${r.checkIn}` : ""}{r.checkOut ? ` · out ${r.checkOut}` : ""}
            </Text>
          </Card>
        );
      })}
    </DashboardScreen>
  );
}
