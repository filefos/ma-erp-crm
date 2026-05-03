import React, { useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import {
  getListAttendanceQueryKey,
  useAttendanceCheckIn, useAttendanceCheckOut,
  useCreateAttendance, useListAttendance, useListEmployees, useUpdateAttendance,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { BrandButton, Card, EmptyState, ErrorBlock, KpiGrid, KpiTile, LoadingBlock, SectionHeading } from "@/components/ui";
import { ActionSheet, FormCell, FormRow, Select, StatusPill } from "@/components/forms";
import { ATTENDANCE_STATUSES, attendanceStatusMeta } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";
import { canMarkAttendance } from "@/lib/permissions";
import { captureAndUploadAttendance, showAttendanceError } from "@/lib/attendance";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
function startOfWeek(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  dt.setDate(dt.getDate() - dow);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export default function AttendanceScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { user, activeCompanyId } = useApp();
  const canManage = canMarkAttendance(user);
  const [view, setView] = useState<"today" | "week" | "month">("today");
  const [date, setDate] = useState<string>(todayKey());
  const [editing, setEditing] = useState<{ employeeId: number; name: string } | null>(null);

  const employees = useListEmployees(activeCompanyId ? { companyId: activeCompanyId } : {});
  const attendance = useListAttendance({});

  const empList = useMemo(() => (employees.data ?? []).filter(e => e.isActive !== false), [employees.data]);
  const empIds = useMemo(() => new Set(empList.map(e => e.id)), [empList]);
  const records = useMemo(() => (attendance.data ?? []).filter(a => empIds.has(a.employeeId)), [attendance.data, empIds]);

  // Self check-in: find current user's employee row by email match.
  const myEmployee = useMemo(() => {
    if (!user) return null;
    const email = (user.email ?? "").toLowerCase();
    return empList.find(e => (e.email ?? "").toLowerCase() === email) ?? null;
  }, [empList, user]);
  const myToday = useMemo(
    () => myEmployee ? records.find(r => r.employeeId === myEmployee.id && r.date === todayKey()) : null,
    [records, myEmployee],
  );

  const create = useCreateAttendance({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() }),
      onError: (e) => Alert.alert("Could not save attendance", (e as Error).message ?? ""),
    },
  });
  const update = useUpdateAttendance({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() }),
      onError: (e) => Alert.alert("Could not update attendance", (e as Error).message ?? ""),
    },
  });
  const checkInMut = useAttendanceCheckIn({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() }),
      onError: (e) => showAttendanceError(e),
    },
  });
  const checkOutMut = useAttendanceCheckOut({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() }),
      onError: (e) => showAttendanceError(e),
    },
  });
  const [busy, setBusy] = useState<null | "in" | "out">(null);

  const checkIn = async () => {
    if (busy) return;
    setBusy("in");
    try {
      const cap = await captureAndUploadAttendance();
      await checkInMut.mutateAsync({
        data: {
          latitude: cap.gps.latitude,
          longitude: cap.gps.longitude,
          accuracyMeters: cap.gps.accuracyMeters ?? undefined,
          address: cap.gps.address,
          selfieObjectKey: cap.selfieObjectKey,
          source: "mobile_gps",
        },
      });
    } catch (e) {
      showAttendanceError(e);
    } finally {
      setBusy(null);
    }
  };
  const checkOut = async () => {
    if (busy || !myToday) return;
    setBusy("out");
    try {
      const cap = await captureAndUploadAttendance();
      await checkOutMut.mutateAsync({
        data: {
          latitude: cap.gps.latitude,
          longitude: cap.gps.longitude,
          accuracyMeters: cap.gps.accuracyMeters ?? undefined,
          address: cap.gps.address,
          selfieObjectKey: cap.selfieObjectKey,
          source: "mobile_gps",
        },
      });
    } catch (e) {
      showAttendanceError(e);
    } finally {
      setBusy(null);
    }
  };

  const setStatusFor = (employeeId: number, status: string) => {
    const existing = records.find(r => r.employeeId === employeeId && r.date === date);
    if (existing) {
      update.mutate({ id: existing.id, data: {
        employeeId, date,
        checkIn: existing.checkIn, checkOut: existing.checkOut,
        overtime: existing.overtime, notes: existing.notes,
        status,
      } });
    } else {
      create.mutate({ data: { employeeId, date, status } });
    }
  };

  // KPIs for current `date`
  const dayRecords = records.filter(r => r.date === date);
  const present = dayRecords.filter(r => r.status === "present").length;
  const absent = dayRecords.filter(r => r.status === "absent").length;
  const onLeave = dayRecords.filter(r => r.status === "leave").length;
  const halfDay = dayRecords.filter(r => r.status === "half_day").length;
  const totalActive = empList.length;
  const unmarked = totalActive - dayRecords.length;

  // Week / Month grids
  const weekStart = useMemo(() => startOfWeek(date), [date]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const monthDays = useMemo(() => {
    const [y, m] = date.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return Array.from({ length: last }, (_, i) => `${y}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`);
  }, [date]);

  const refreshing = employees.isRefetching || attendance.isRefetching;
  const refresh = () => { employees.refetch(); attendance.refetch(); };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <AppHeader title="Attendance" subtitle={date} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} />}
      >
        {/* Self check-in card with GPS + selfie */}
        {myEmployee ? (
          <Card>
            <View style={styles.row}>
              <Text style={[styles.title, { color: c.foreground, flex: 1 }]}>My attendance · today</Text>
              {myToday ? <StatusPill label={attendanceStatusMeta(myToday.status).label} tone={attendanceStatusMeta(myToday.status).tone} /> : null}
            </View>
            <Text style={[styles.meta, { color: c.mutedForeground }]}>
              {myToday?.checkIn ? `In ${myToday.checkIn}` : "Not checked in"}
              {myToday?.checkOut ? ` · Out ${myToday.checkOut}` : ""}
            </Text>
            {myToday?.address ? (
              <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={2}>
                <Feather name="map-pin" size={11} color={c.mutedForeground} /> {myToday.address}
              </Text>
            ) : null}
            <View style={styles.row}>
              {(myToday as any)?.selfieSignedUrl ? (
                <Image
                  source={{ uri: (myToday as any).selfieSignedUrl }}
                  style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: c.muted }}
                  contentFit="cover"
                />
              ) : null}
              {(myToday as any)?.checkOutSelfieSignedUrl ? (
                <Image
                  source={{ uri: (myToday as any).checkOutSelfieSignedUrl }}
                  style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: c.muted }}
                  contentFit="cover"
                />
              ) : null}
              {!myToday ? (
                <BrandButton label="Check in (GPS + selfie)" icon="camera" onPress={checkIn} loading={busy === "in"} style={{ flex: 1, minWidth: 200 }} />
              ) : !myToday.checkOut ? (
                <BrandButton label="Check out (GPS + selfie)" icon="camera" variant="secondary" onPress={checkOut} loading={busy === "out"} style={{ flex: 1, minWidth: 200 }} />
              ) : (
                <Text style={[styles.meta, { color: c.success }]}>Day complete · thanks!</Text>
              )}
            </View>
            {!myToday ? (
              <Text style={[styles.meta, { color: c.mutedForeground, fontSize: 11 }]}>
                Location and a wide-angle selfie are required for check-in. Both are uploaded securely.
              </Text>
            ) : null}
          </Card>
        ) : null}

        {/* View switch */}
        <View style={[styles.tabs, { backgroundColor: c.card, borderColor: c.border }]}>
          {(["today", "week", "month"] as const).map(v => (
            <Pressable key={v} onPress={() => setView(v)} style={[styles.tabBtn, view === v && { backgroundColor: c.primary }]}>
              <Text style={[styles.tabTxt, { color: view === v ? "#fff" : c.foreground }]}>{v.charAt(0).toUpperCase() + v.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        {/* Date stepper */}
        <View style={styles.row}>
          <BrandButton label="◀" variant="secondary" onPress={() => setDate(addDays(date, view === "month" ? -30 : view === "week" ? -7 : -1))} style={{ minWidth: 60 }} />
          <Text style={[styles.title, { color: c.foreground, flex: 1, textAlign: "center" }]}>{date}</Text>
          <BrandButton label="▶" variant="secondary" onPress={() => setDate(addDays(date, view === "month" ? 30 : view === "week" ? 7 : 1))} style={{ minWidth: 60 }} />
        </View>
        <BrandButton label="Today" icon="calendar" variant="ghost" onPress={() => setDate(todayKey())} />

        {employees.isLoading || attendance.isLoading ? <LoadingBlock label="Loading…" /> : null}
        {employees.error ? <ErrorBlock message={(employees.error as Error).message ?? "Error"} onRetry={refresh} /> : null}

        {view === "today" ? (
          <>
            <SectionHeading title="Snapshot" />
            <KpiGrid>
              <KpiTile label="Present" value={present} icon="check-circle" tone="navy" />
              <KpiTile label="Absent" value={absent} icon="x-circle" tone="orange" hint={`${onLeave} on leave`} />
              <KpiTile label="Half day" value={halfDay} icon="clock" tone="blue" />
              <KpiTile label="Unmarked" value={Math.max(0, unmarked)} icon="alert-circle" tone="muted" hint={`${totalActive} active`} />
            </KpiGrid>

            <SectionHeading title={canManage ? "Manager grid · tap to set status" : "Team grid"} />
            {empList.length === 0 ? (
              <EmptyState icon="users" title="No active employees" hint="Add employees in HR to track attendance." />
            ) : null}
            {empList.map(e => {
              const r = records.find(x => x.employeeId === e.id && x.date === date);
              const sm = attendanceStatusMeta(r?.status);
              return (
                <Pressable key={e.id} onPress={() => canManage ? setEditing({ employeeId: e.id, name: e.name }) : null}>
                  <Card>
                    <View style={styles.row}>
                      <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{e.name}</Text>
                      <StatusPill label={r ? sm.label : "Not marked"} tone={r ? sm.tone : "muted"} />
                    </View>
                    <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={1}>
                      {e.designation ?? "—"}
                      {r?.checkIn ? ` · in ${r.checkIn}` : ""}
                      {r?.checkOut ? ` · out ${r.checkOut}` : ""}
                      {r?.overtime ? ` · OT ${r.overtime}h` : ""}
                    </Text>
                  </Card>
                </Pressable>
              );
            })}
          </>
        ) : view === "week" ? (
          <>
            <SectionHeading title={`Week starting ${weekStart}`} />
            {empList.map(e => (
              <Card key={e.id}>
                <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>{e.name}</Text>
                <View style={styles.weekRow}>
                  {weekDays.map(d => {
                    const r = records.find(x => x.employeeId === e.id && x.date === d);
                    const tone = r?.status === "present" ? c.success
                      : r?.status === "absent" ? c.destructive
                      : r?.status === "leave" ? c.primary
                      : r?.status === "half_day" ? c.accent
                      : c.muted;
                    return (
                      <View key={d} style={styles.weekCell}>
                        <Text style={[styles.weekLabel, { color: c.mutedForeground }]}>{d.slice(-2)}</Text>
                        <View style={[styles.weekDot, { backgroundColor: tone }]} />
                      </View>
                    );
                  })}
                </View>
              </Card>
            ))}
          </>
        ) : (
          <>
            <SectionHeading title={`Month · ${date.slice(0, 7)}`} />
            {empList.map(e => {
              const empRecords = records.filter(r => r.employeeId === e.id && r.date.startsWith(date.slice(0, 7)));
              const presentCount = empRecords.filter(r => r.status === "present").length;
              const absentCount = empRecords.filter(r => r.status === "absent").length;
              const otTotal = empRecords.reduce((s, r) => s + Number(r.overtime ?? 0), 0);
              return (
                <Card key={e.id}>
                  <View style={styles.row}>
                    <Text style={[styles.title, { color: c.foreground, flex: 1 }]} numberOfLines={1}>{e.name}</Text>
                    <Text style={[styles.meta, { color: c.success }]}>{presentCount} present</Text>
                  </View>
                  <View style={styles.monthGrid}>
                    {monthDays.map(d => {
                      const r = empRecords.find(x => x.date === d);
                      const tone = r?.status === "present" ? c.success
                        : r?.status === "absent" ? c.destructive
                        : r?.status === "leave" ? c.primary
                        : r?.status === "half_day" ? c.accent
                        : c.muted;
                      return <View key={d} style={[styles.monthDot, { backgroundColor: tone }]} />;
                    })}
                  </View>
                  <Text style={[styles.meta, { color: c.mutedForeground }]}>
                    {absentCount} absent · {empRecords.filter(r => r.status === "leave").length} leave · OT {otTotal.toFixed(1)}h
                  </Text>
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>

      <ActionSheet
        visible={editing != null}
        onClose={() => setEditing(null)}
        title={`Status for ${editing?.name ?? ""}`}
        actions={ATTENDANCE_STATUSES.map(s => ({
          label: s.label,
          icon: "tag",
          onPress: () => {
            if (editing) setStatusFor(editing.employeeId, s.value);
            setEditing(null);
          },
        }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { fontFamily: "Inter_700Bold", fontSize: 14 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  tabs: { flexDirection: "row", padding: 4, borderRadius: 12, borderWidth: 1, gap: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabTxt: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  weekRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  weekCell: { alignItems: "center", gap: 4 },
  weekLabel: { fontFamily: "Inter_500Medium", fontSize: 10 },
  weekDot: { width: 26, height: 26, borderRadius: 13 },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginVertical: 6 },
  monthDot: { width: 14, height: 14, borderRadius: 4 },
});
