import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useListProjects } from "@workspace/api-client-react";
import { DashboardScreen } from "@/components/Dashboard";
import { Card, EmptyState, KpiGrid, KpiTile, QuickLink, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { PROJECT_STAGES, fmtAed, fmtCompact, fmtDate, num, projectStageMeta } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

export default function ProjectsDashboard() {
  const router = useRouter();
  const { activeCompanyId } = useApp();
  const q = useListProjects(activeCompanyId ? { companyId: activeCompanyId } : {});
  const projects = useMemo(() => q.data ?? [], [q.data]);

  const totalValue = projects.reduce((s, p) => s + num(p.projectValue), 0);
  const active = projects.filter(p => p.stage !== "completed").length;
  const completed = projects.filter(p => p.stage === "completed").length;
  const overdue = projects.filter(p => p.endDate && new Date(p.endDate) < new Date() && p.stage !== "completed").length;

  const byStage = useMemo(() => {
    return PROJECT_STAGES.map(s => ({
      ...s,
      count: projects.filter(p => p.stage === s.value).length,
      value: projects.filter(p => p.stage === s.value).reduce((sm, p) => sm + num(p.projectValue), 0),
    })).filter(r => r.count > 0);
  }, [projects]);

  const upcoming = useMemo(() => projects
    .filter(p => p.endDate && p.stage !== "completed")
    .sort((a, b) => (a.endDate ?? "").localeCompare(b.endDate ?? ""))
    .slice(0, 6),
  [projects]);

  return (
    <DashboardScreen title="Projects Dashboard" subtitle="Stage progress, value, upcoming deadlines">
      <SectionHeading title="Snapshot" />
      <KpiGrid>
        <KpiTile label="Total value" value={`AED ${fmtCompact(totalValue)}`} icon="dollar-sign" tone="navy" hint={`${projects.length} projects`} />
        <KpiTile label="Active" value={active} icon="play" tone="blue" />
        <KpiTile label="Completed" value={completed} icon="check-circle" tone="muted" />
        <KpiTile label="Overdue" value={overdue} icon="alert-triangle" tone="orange" />
      </KpiGrid>

      <SectionHeading title="Quick actions" />
      <QuickLink icon="folder" label="All projects" hint={`${projects.length} total`} onPress={() => router.push("/projects/list")} />
      <QuickLink icon="target" label="Sales performance" hint="Targets vs achieved" onPress={() => router.push("/projects/sales-performance")} />
      <QuickLink icon="plus" label="New project" onPress={() => router.push("/projects/new")} />

      <SectionHeading title="By stage" />
      {byStage.length === 0 ? <EmptyState icon="bar-chart-2" title="No projects yet" /> : null}
      {byStage.map(s => {
        const max = byStage[0]?.count || 1;
        return (
          <Card key={s.value}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 }}>{s.label}</Text>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13 }}>{s.count}</Text>
            </View>
            <View style={{ height: 6, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
              <View style={{ height: 6, width: `${(s.count / max) * 100}%`, backgroundColor: "#1e6ab0" }} />
            </View>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#64748b", marginTop: 4 }}>
              AED {fmtCompact(s.value)}
            </Text>
          </Card>
        );
      })}

      <SectionHeading title="Upcoming deadlines" />
      {upcoming.length === 0 ? <EmptyState icon="calendar" title="No upcoming deadlines" /> : null}
      {upcoming.map(p => {
        const sm = projectStageMeta(p.stage);
        return (
          <Card key={p.id}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 }} numberOfLines={1}>{p.projectName}</Text>
              <StatusPill label={sm.label} tone={sm.tone} />
            </View>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#64748b", marginTop: 2 }}>
              {p.clientName} · End {fmtDate(p.endDate)} · {fmtAed(p.projectValue ?? 0)}
            </Text>
          </Card>
        );
      })}
    </DashboardScreen>
  );
}
