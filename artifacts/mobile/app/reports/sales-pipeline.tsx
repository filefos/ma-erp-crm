import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useListLeads, useListQuotations } from "@workspace/api-client-react";
import { DashboardScreen } from "@/components/Dashboard";
import { Card, EmptyState, KpiGrid, KpiTile, SectionHeading } from "@/components/ui";
import { LEAD_STATUSES, fmtCompact, leadStatusMeta, num } from "@/lib/format";
import { inRange, useReportFilters } from "@/components/forms/ReportFilters";

export default function SalesPipelineReport() {
  const { state, filters } = useReportFilters("12mo");
  const { from, to, companyId } = state;
  const leadsQ = useListLeads({});
  const quotesQ = useListQuotations();

  const leads = useMemo(
    () => (leadsQ.data ?? []).filter(l => (companyId == null || l.companyId === companyId) && inRange(l.createdAt, from, to)),
    [leadsQ.data, companyId, from, to],
  );
  const quotations = useMemo(
    () => (quotesQ.data ?? []).filter(q => (companyId == null || q.companyId === companyId) && inRange(q.createdAt, from, to)),
    [quotesQ.data, companyId, from, to],
  );

  const won = leads.filter(l => l.status === "won").length;
  const lost = leads.filter(l => l.status === "lost").length;
  const active = leads.filter(l => l.status !== "won" && l.status !== "lost").length;
  const conversion = leads.length > 0 ? Math.round((won / leads.length) * 100) : 0;

  const byStatus = useMemo(() => {
    return LEAD_STATUSES.map(s => ({
      ...s,
      count: leads.filter(l => l.status === s.value).length,
    })).filter(r => r.count > 0);
  }, [leads]);
  const max = Math.max(...byStatus.map(b => b.count), 1);

  const quoteValue = quotations.reduce((s, q) => s + num(q.grandTotal), 0);
  const quoteApproved = quotations.filter(q => q.status === "approved").length;

  return (
    <DashboardScreen title="Sales pipeline" subtitle={`${leads.length} leads · ${quotations.length} quotes`}>
      {filters}
      <SectionHeading title="Snapshot" />
      <KpiGrid>
        <KpiTile label="Active leads" value={active} icon="users" tone="blue" />
        <KpiTile label="Won" value={won} icon="award" tone="navy" hint={`${conversion}% conversion`} />
        <KpiTile label="Lost" value={lost} icon="x-circle" tone="orange" />
        <KpiTile label="Quote value" value={`AED ${fmtCompact(quoteValue)}`} icon="file-text" tone="muted" hint={`${quoteApproved} approved`} />
      </KpiGrid>

      <SectionHeading title="Lead funnel" />
      {byStatus.length === 0 ? <EmptyState icon="filter" title="No leads in range" /> : null}
      {byStatus.map(s => {
        const meta = leadStatusMeta(s.value);
        return (
          <Card key={s.value}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{meta.label}</Text>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13 }}>{s.count}</Text>
            </View>
            <View style={{ height: 6, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
              <View style={{ height: 6, width: `${(s.count / max) * 100}%`, backgroundColor: "#1e6ab0" }} />
            </View>
          </Card>
        );
      })}
    </DashboardScreen>
  );
}
