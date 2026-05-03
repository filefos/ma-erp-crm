import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useListAttendance, useListEmployees } from "@workspace/api-client-react";
import { DashboardScreen } from "@/components/Dashboard";
import { Card, EmptyState, KpiGrid, KpiTile, SectionHeading } from "@/components/ui";
import { inRange, useReportFilters } from "@/components/forms/ReportFilters";

function localDayKey(raw?: string | null) {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AttendanceReport() {
  const { state, filters } = useReportFilters("30d");
  const { from, to, companyId } = state;
  const employees = useListEmployees(companyId ? { companyId } : {});
  const attendance = useListAttendance({});

  const empList = employees.data ?? [];
  const empIds = useMemo(() => new Set(empList.map(e => e.id)), [empList]);
  const records = useMemo(
    () => (attendance.data ?? []).filter(a => empIds.has(a.employeeId) && inRange(a.date, from, to)),
    [attendance.data, empIds, from, to],
  );

  const today = localDayKey(new Date().toISOString())!;
  const presentToday = records.filter(r => r.date === today && r.status === "present").length;
  const totalActive = empList.filter(e => e.isActive !== false).length;
  const attendancePct = totalActive > 0 ? Math.round((presentToday / totalActive) * 100) : 0;

  const trend = useMemo(() => {
    const days: { day: string; present: number; absent: number; leave: number }[] = [];
    const fromDate = from ? new Date(from) : new Date(Date.now() - 13 * 86_400_000);
    const toDate = new Date(to);
    const span = Math.min(60, Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1));
    for (let i = span - 1; i >= 0; i--) {
      const d = new Date(toDate);
      d.setDate(toDate.getDate() - i);
      const key = localDayKey(d.toISOString())!;
      const dayRecords = records.filter(r => r.date === key);
      days.push({
        day: key.slice(5),
        present: dayRecords.filter(r => r.status === "present").length,
        absent: dayRecords.filter(r => r.status === "absent").length,
        leave: dayRecords.filter(r => r.status === "leave").length,
      });
    }
    return days;
  }, [records, from, to]);

  const max = Math.max(...trend.map(d => d.present + d.absent + d.leave), 1);

  const top = useMemo(() => {
    const m: Record<number, { id: number; name: string; present: number; ot: number }> = {};
    for (const r of records) {
      const e = empList.find(x => x.id === r.employeeId);
      if (!e) continue;
      const entry = m[e.id] ?? { id: e.id, name: e.name, present: 0, ot: 0 };
      if (r.status === "present") entry.present++;
      entry.ot += Number(r.overtime ?? 0);
      m[e.id] = entry;
    }
    return Object.values(m).sort((a, b) => b.present - a.present).slice(0, 6);
  }, [records, empList]);

  const otTotal = records.filter(r => r.date === today).reduce((s, r) => s + Number(r.overtime ?? 0), 0);

  return (
    <DashboardScreen title="Attendance report" subtitle={`${empList.length} employees`}>
      {filters}
      <SectionHeading title="Today" />
      <KpiGrid>
        <KpiTile label="Present" value={presentToday} icon="check-circle" tone="navy" hint={`${attendancePct}% of ${totalActive}`} />
        <KpiTile label="Absent" value={records.filter(r => r.date === today && r.status === "absent").length} icon="x-circle" tone="orange" />
        <KpiTile label="On leave" value={records.filter(r => r.date === today && r.status === "leave").length} icon="briefcase" tone="blue" />
        <KpiTile label="Overtime" value={otTotal.toFixed(1)} icon="clock" tone="muted" hint="Hours" />
      </KpiGrid>

      <SectionHeading title="Daily trend" />
      {trend.every(d => d.present + d.absent + d.leave === 0) ? <EmptyState icon="bar-chart-2" title="No records in range" /> : null}
      {trend.map(d => (
        <Card key={d.day}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{d.day}</Text>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#64748b" }}>
              ✓ {d.present}  ✗ {d.absent}  · leave {d.leave}
            </Text>
          </View>
          <View style={{ flexDirection: "row", marginTop: 6, gap: 2 }}>
            <View style={{ height: 6, flex: d.present || 0.001, backgroundColor: "#16a34a", borderRadius: 3 }} />
            <View style={{ height: 6, flex: d.absent || 0.001, backgroundColor: "#dc2626", borderRadius: 3 }} />
            <View style={{ height: 6, flex: d.leave || 0.001, backgroundColor: "#1e6ab0", borderRadius: 3 }} />
            <View style={{ height: 6, flex: Math.max(0, max - d.present - d.absent - d.leave), backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 3 }} />
          </View>
        </Card>
      ))}

      <SectionHeading title="Top performers" />
      {top.length === 0 ? <EmptyState icon="award" title="No data" /> : null}
      {top.map((p, i) => (
        <Card key={p.id}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: "#1e6ab0", width: 24 }}>#{i + 1}</Text>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 }} numberOfLines={1}>{p.name}</Text>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#16a34a" }}>{p.present} days</Text>
          </View>
          {p.ot > 0 ? <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#64748b", marginLeft: 32, marginTop: 2 }}>OT: {p.ot.toFixed(1)}h</Text> : null}
        </Card>
      ))}
    </DashboardScreen>
  );
}
