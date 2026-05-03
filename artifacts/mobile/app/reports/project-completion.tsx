import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useListProjects } from "@workspace/api-client-react";
import { DashboardScreen } from "@/components/Dashboard";
import { Card, EmptyState, KpiGrid, KpiTile, SectionHeading } from "@/components/ui";
import { StatusPill } from "@/components/forms";
import { PROJECT_STAGES, fmtAed, fmtCompact, fmtDate, num, projectStageMeta } from "@/lib/format";
import { inRange, useReportFilters } from "@/components/forms/ReportFilters";

export default function ProjectCompletionReport() {
  const { state, filters } = useReportFilters("12mo");
  const { from, to, companyId } = state;
  const q = useListProjects(companyId ? { companyId } : {});
  const projects = useMemo(
    () => (q.data ?? []).filter(p => inRange(p.startDate ?? p.createdAt, from, to)),
    [q.data, from, to],
  );

  const total = projects.length;
  const completed = projects.filter(p => p.stage === "completed").length;
  const inProgress = projects.filter(p => p.stage !== "completed").length;
  const overdue = projects.filter(p => p.endDate && new Date(p.endDate) < new Date() && p.stage !== "completed").length;
  const completion = total > 0 ? Math.round((completed / total) * 100) : 0;
  const totalValue = projects.reduce((s, p) => s + num(p.projectValue), 0);
  const completedValue = projects.filter(p => p.stage === "completed").reduce((s, p) => s + num(p.projectValue), 0);

  const byStage = useMemo(() => PROJECT_STAGES.map(s => ({
    ...s,
    count: projects.filter(p => p.stage === s.value).length,
  })).filter(r => r.count > 0), [projects]);

  const max = Math.max(...byStage.map(s => s.count), 1);

  const overdueProjects = useMemo(() => projects
    .filter(p => p.endDate && new Date(p.endDate) < new Date() && p.stage !== "completed")
    .sort((a, b) => (a.endDate ?? "").localeCompare(b.endDate ?? ""))
    .slice(0, 6),
  [projects]);

  return (
    <DashboardScreen title="Project completion" subtitle={`${completion}% complete`}>
      {filters}
      <SectionHeading title="Snapshot" />
      <KpiGrid>
        <KpiTile label="Total" value={total} icon="folder" tone="navy" hint={`AED ${fmtCompact(totalValue)}`} />
        <KpiTile label="Completed" value={completed} icon="check-circle" tone="blue" hint={`AED ${fmtCompact(completedValue)}`} />
        <KpiTile label="In progress" value={inProgress} icon="play" tone="muted" />
        <KpiTile label="Overdue" value={overdue} icon="alert-triangle" tone="orange" />
      </KpiGrid>

      <SectionHeading title="By stage" />
      {byStage.length === 0 ? <EmptyState icon="bar-chart-2" title="No projects in range" /> : null}
      {byStage.map(s => (
        <Card key={s.value}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{s.label}</Text>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13 }}>{s.count}</Text>
          </View>
          <View style={{ height: 6, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
            <View style={{ height: 6, width: `${(s.count / max) * 100}%`, backgroundColor: "#1e6ab0" }} />
          </View>
        </Card>
      ))}

      <SectionHeading title="Overdue projects" />
      {overdueProjects.length === 0 ? <EmptyState icon="check-circle" title="No overdue projects" hint="All projects are on track." /> : null}
      {overdueProjects.map(p => {
        const sm = projectStageMeta(p.stage);
        return (
          <Card key={p.id}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 }} numberOfLines={1}>{p.projectName}</Text>
              <StatusPill label={sm.label} tone={sm.tone} />
            </View>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#dc2626", marginTop: 2 }}>
              Due {fmtDate(p.endDate)} · {fmtAed(p.projectValue ?? 0)}
            </Text>
          </Card>
        );
      })}
    </DashboardScreen>
  );
}
