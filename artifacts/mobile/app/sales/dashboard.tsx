import React, { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListAttendanceQueryKey,
  useAttendanceCheckIn, useAttendanceCheckOut,
  useListAttendance, useListEmployees, useListLpos, useListProformaInvoices, useListQuotations,
} from "@workspace/api-client-react";
import { DashboardScreen } from "@/components/Dashboard";
import { BrandButton, Card, EmptyState, KpiGrid, KpiTile, QuickLink, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { fmtAed, fmtCompact, num, quotationStatusMeta, attendanceStatusMeta } from "@/lib/format";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/contexts/AppContext";
import { captureAndUploadAttendance, showAttendanceError } from "@/lib/attendance";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function SalesDashboard() {
  const c = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, activeCompanyId } = useApp();
  const quotes = useListQuotations();
  const pis = useListProformaInvoices();
  const lpos = useListLpos();
  const employees = useListEmployees(activeCompanyId ? { companyId: activeCompanyId } : {});
  const attendance = useListAttendance({ date: todayKey() });

  const myEmployee = useMemo(() => {
    if (!user) return null;
    const email = (user.email ?? "").toLowerCase();
    return (employees.data ?? []).find(e => (e.email ?? "").toLowerCase() === email) ?? null;
  }, [employees.data, user]);
  const myToday = useMemo(
    () => myEmployee ? (attendance.data ?? []).find(r => r.employeeId === myEmployee.id && r.date === todayKey()) : null,
    [attendance.data, myEmployee],
  );
  const recent = useMemo(
    () => (attendance.data ?? [])
      .filter(r => r.employeeId === myEmployee?.id)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 5),
    [attendance.data, myEmployee],
  );

  const checkIn = useAttendanceCheckIn({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() }),
      onError: (e) => showAttendanceError(e),
    },
  });
  const checkOut = useAttendanceCheckOut({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() }),
      onError: (e) => showAttendanceError(e),
    },
  });
  const [busy, setBusy] = useState<null | "in" | "out">(null);

  const doCheckIn = async () => {
    if (busy) return;
    setBusy("in");
    try {
      const cap = await captureAndUploadAttendance();
      await checkIn.mutateAsync({ data: {
        latitude: cap.gps.latitude, longitude: cap.gps.longitude,
        accuracyMeters: cap.gps.accuracyMeters ?? undefined,
        address: cap.gps.address, selfieObjectKey: cap.selfieObjectKey,
        source: "mobile_gps",
      } });
    } catch (e) { showAttendanceError(e); } finally { setBusy(null); }
  };
  const doCheckOut = async () => {
    if (busy) return;
    setBusy("out");
    try {
      const cap = await captureAndUploadAttendance();
      await checkOut.mutateAsync({ data: {
        latitude: cap.gps.latitude, longitude: cap.gps.longitude,
        accuracyMeters: cap.gps.accuracyMeters ?? undefined,
        address: cap.gps.address, selfieObjectKey: cap.selfieObjectKey,
        source: "mobile_gps",
      } });
    } catch (e) { showAttendanceError(e); } finally { setBusy(null); }
  };

  const totals = useMemo(() => {
    const qData = quotes.data ?? [];
    const totalValue = qData.reduce((s, q) => s + num(q.grandTotal), 0);
    const draft = qData.filter(q => (q.status ?? "").toLowerCase() === "draft").length;
    const sent = qData.filter(q => (q.status ?? "").toLowerCase() === "sent").length;
    const approved = qData.filter(q => (q.status ?? "").toLowerCase() === "approved").length;
    const lpoValue = (lpos.data ?? []).reduce((s, l) => s + num(l.lpoValue), 0);
    return { totalValue, draft, sent, approved, lpoValue };
  }, [quotes.data, lpos.data]);

  const recent = useMemo(
    () => [...(quotes.data ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5),
    [quotes.data],
  );

  const leaderboard = useMemo(() => {
    const buckets = new Map<string, { name: string; total: number; approved: number; count: number }>();
    for (const q of quotes.data ?? []) {
      const name = q.preparedByName ?? "Unassigned";
      const cur = buckets.get(name) ?? { name, total: 0, approved: 0, count: 0 };
      cur.total += num(q.grandTotal);
      cur.count += 1;
      if ((q.status ?? "").toLowerCase() === "approved") cur.approved += 1;
      buckets.set(name, cur);
    }
    return [...buckets.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [quotes.data]);

  return (
    <DashboardScreen title="Sales dashboard" subtitle="Pipeline, conversion and recent activity">
      {myEmployee ? (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name="map-pin" size={16} color={c.primary} />
            <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
              Field attendance · today
            </Text>
            {myToday ? <StatusPill label={attendanceStatusMeta(myToday.status).label} tone={attendanceStatusMeta(myToday.status).tone} /> : null}
          </View>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
            {myToday?.checkIn ? `In ${myToday.checkIn}` : "Not checked in"}
            {myToday?.checkOut ? ` · Out ${myToday.checkOut}` : ""}
          </Text>
          {myToday?.address ? (
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }} numberOfLines={2}>
              {myToday.address}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {(myToday as any)?.selfieSignedUrl ? (
              <Image
                source={{ uri: (myToday as any).selfieSignedUrl }}
                style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: c.muted }}
                contentFit="cover"
              />
            ) : null}
            {(myToday as any)?.checkOutSelfieSignedUrl ? (
              <Image
                source={{ uri: (myToday as any).checkOutSelfieSignedUrl }}
                style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: c.muted }}
                contentFit="cover"
              />
            ) : null}
            {!myToday ? (
              <BrandButton label="Check in" icon="camera" onPress={doCheckIn} loading={busy === "in"} style={{ flex: 1, minWidth: 160 }} />
            ) : !myToday.checkOut ? (
              <BrandButton label="Check out" icon="camera" variant="secondary" onPress={doCheckOut} loading={busy === "out"} style={{ flex: 1, minWidth: 160 }} />
            ) : (
              <Text style={{ color: c.success, fontFamily: "Inter_700Bold", fontSize: 13 }}>Day complete · thanks!</Text>
            )}
          </View>
          {!myToday ? (
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }}>
              GPS location and a quick selfie are required to verify on-site attendance.
            </Text>
          ) : null}
          {recent.length > 1 ? (
            <View style={{ marginTop: 6, gap: 4 }}>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>Recent</Text>
              {recent.slice(0, 3).map(r => (
                <Text key={r.id} style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }} numberOfLines={1}>
                  {r.date} · in {r.checkIn ?? "—"} · out {r.checkOut ?? "—"}{r.address ? ` · ${r.address}` : ""}
                </Text>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      <SectionHeading title="Pipeline KPIs" />
      <KpiGrid>
        <KpiTile label="Quotations value" value={fmtCompact(totals.totalValue)} icon="dollar-sign" tone="navy" hint="AED" />
        <KpiTile label="Draft" value={totals.draft} icon="edit-3" tone="muted" />
        <KpiTile label="Sent" value={totals.sent} icon="send" tone="blue" />
        <KpiTile label="Approved" value={totals.approved} icon="check" tone="orange" />
        <KpiTile label="LPO value" value={fmtCompact(totals.lpoValue)} icon="check-square" tone="navy" hint="AED" />
        <KpiTile label="Proforma invoices" value={(pis.data ?? []).length} icon="file" tone="blue" />
      </KpiGrid>

      <SectionHeading title="Quick actions" />
      <QuickLink icon="plus" label="New quotation" onPress={() => router.push("/sales/quotations/new")} />
      <QuickLink icon="file" label="New proforma invoice" onPress={() => router.push("/sales/proforma-invoices/new")} />
      <QuickLink icon="check-square" label="New LPO" onPress={() => router.push("/sales/lpos/new")} />

      <SectionHeading title="Sales leaderboard" />
      {leaderboard.length === 0 ? <EmptyState icon="award" title="No data yet" hint="Create quotations to populate the leaderboard." /> : null}
      {leaderboard.map((row, i) => (
        <Card key={row.name}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: i === 0 ? c.accent : c.secondary }}>
              <Text style={{ color: i === 0 ? "#ffffff" : c.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>#{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }} numberOfLines={1}>{row.name}</Text>
              <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>{row.count} quote{row.count === 1 ? "" : "s"} · {row.approved} approved</Text>
            </View>
            <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>{fmtAed(row.total)}</Text>
          </View>
        </Card>
      ))}

      <SectionHeading title="Recent quotations" />
      {recent.length === 0 ? <EmptyState icon="file-text" title="No quotations yet" hint="Create your first quote to populate the pipeline." /> : null}
      {recent.map(q => {
        const sm = quotationStatusMeta(q.status);
        return (
          <Card key={q.id}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }} numberOfLines={1}>{q.quotationNumber}</Text>
              <StatusPill label={sm.label} tone={sm.tone} />
            </View>
            <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }} numberOfLines={1}>{q.clientName}</Text>
            <Text style={{ color: c.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>{fmtAed(q.grandTotal)}</Text>
          </Card>
        );
      })}
    </DashboardScreen>
  );
}
