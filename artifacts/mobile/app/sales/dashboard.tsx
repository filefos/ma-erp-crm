import React, { useMemo } from "react";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { useListLpos, useListProformaInvoices, useListQuotations } from "@workspace/api-client-react";
import { DashboardScreen } from "@/components/Dashboard";
import { Card, EmptyState, KpiGrid, KpiTile, QuickLink, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { fmtAed, fmtCompact, num, quotationStatusMeta } from "@/lib/format";
import { useColors } from "@/hooks/useColors";

export default function SalesDashboard() {
  const c = useColors();
  const router = useRouter();
  const quotes = useListQuotations();
  const pis = useListProformaInvoices();
  const lpos = useListLpos();

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
