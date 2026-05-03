import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useListProjects, useListSalesTargets, useListUsers } from "@workspace/api-client-react";
import { DashboardScreen } from "@/components/Dashboard";
import { Card, EmptyState, KpiGrid, KpiTile, SectionHeading } from "@/components/ui";
import { Select, StatusPill } from "@/components/forms";
import { fmtAed, fmtCompact, num } from "@/lib/format";
import { useApp } from "@/contexts/AppContext";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function isProjectInPeriod(p: { startDate?: string; createdAt?: string }, year: number, month?: number): boolean {
  const raw = p.startDate || p.createdAt;
  if (!raw) return false;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return false;
  if (d.getFullYear() !== year) return false;
  if (month != null && d.getMonth() + 1 !== month) return false;
  return true;
}

export default function SalesPerformance() {
  const { activeCompanyId } = useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<string>(String(now.getMonth() + 1));

  const projects = useListProjects(activeCompanyId ? { companyId: activeCompanyId } : {});
  const users = useListUsers();
  const targets = useListSalesTargets({ year });

  const projectList = useMemo(
    () => (projects.data ?? []).filter(p => activeCompanyId == null || p.companyId === activeCompanyId),
    [projects.data, activeCompanyId],
  );
  const targetList = useMemo(
    () => (targets.data ?? []).filter(t => activeCompanyId == null || t.companyId === activeCompanyId),
    [targets.data, activeCompanyId],
  );
  const salesUsers = useMemo(() => (users.data ?? []).filter(u => {
    if (activeCompanyId != null) {
      const inPrimary = u.companyId === activeCompanyId;
      const inAccessible = (u.accessibleCompanies ?? []).some(co => co.id === activeCompanyId);
      if (!inPrimary && !inAccessible) return false;
    }
    const r = (u.role ?? "").toLowerCase();
    return r === "sales" || r.includes("sales") || r === "main_admin" || r === "admin" || r === "manager";
  }), [users.data, activeCompanyId]);

  const monthFilter = month === "all" ? undefined : Number(month);

  const rows = useMemo(() => {
    return salesUsers.map(u => {
      const myProjects = projectList.filter(p => p.salespersonId === u.id && isProjectInPeriod(p, year, monthFilter));
      const achieved = myProjects.reduce((s, p) => s + num(p.projectValue), 0);
      const userTargets = targetList.filter(t => t.userId === u.id && t.year === year);
      let target = 0;
      if (monthFilter != null) {
        const q = Math.ceil(monthFilter / 3);
        for (const t of userTargets) {
          if (t.period === "monthly" && t.month === monthFilter) target += num(t.targetAmount);
          else if (t.period === "quarterly" && t.quarter === q) target += num(t.targetAmount) / 3;
          else if (t.period === "yearly") target += num(t.targetAmount) / 12;
        }
      } else {
        target = userTargets.reduce((s, t) => s + num(t.targetAmount), 0);
      }
      const remaining = Math.max(0, target - achieved);
      const attainment = target > 0 ? Math.min(999, Math.round((achieved / target) * 100)) : 0;
      return { id: u.id, name: u.name, role: u.role, target, achieved, remaining, attainment, projectCount: myProjects.length };
    }).sort((a, b) => b.achieved - a.achieved);
  }, [salesUsers, projectList, targetList, year, monthFilter]);

  const teamTarget = rows.reduce((s, r) => s + r.target, 0);
  const teamAchieved = rows.reduce((s, r) => s + r.achieved, 0);
  const teamRemaining = Math.max(0, teamTarget - teamAchieved);
  const teamAttain = teamTarget > 0 ? Math.round((teamAchieved / teamTarget) * 100) : 0;

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <DashboardScreen title="Sales Performance" subtitle="Targets vs achieved by salesperson">
      <Select label="Year" value={String(year)} options={years.map(y => ({ value: String(y), label: String(y) }))} onChange={v => setYear(Number(v))} />
      <Select label="Month" value={month} options={[{ value: "all", label: "Full year" }, ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))]} onChange={setMonth} />

      <SectionHeading title="Team totals" />
      <KpiGrid>
        <KpiTile label="Target" value={`AED ${fmtCompact(teamTarget)}`} icon="target" tone="navy" />
        <KpiTile label="Achieved" value={`AED ${fmtCompact(teamAchieved)}`} icon="award" tone="blue" hint={`${teamAttain}% of target`} />
        <KpiTile label="Remaining" value={`AED ${fmtCompact(teamRemaining)}`} icon="trending-up" tone="orange" />
        <KpiTile label="Salespeople" value={rows.length} icon="users" tone="muted" />
      </KpiGrid>

      <SectionHeading title="Salesperson breakdown" />
      {rows.length === 0 ? <EmptyState icon="users" title="No sales users" hint="Sales users will appear here once added." /> : null}
      {rows.map(r => {
        const tone: "success" | "blue" | "orange" | "destructive" =
          r.attainment >= 100 ? "success" :
          r.attainment >= 75 ? "blue" :
          r.attainment >= 40 ? "orange" : "destructive";
        const label = r.attainment >= 100 ? "Exceeded" : r.attainment >= 75 ? "On track" : r.attainment >= 40 ? "Behind" : "At risk";
        return (
          <Card key={r.id}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, flex: 1 }} numberOfLines={1}>{r.name}</Text>
              <StatusPill label={label} tone={tone} />
            </View>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#64748b", marginTop: 2 }}>
              {(r.role ?? "").replace(/_/g, " ")} · {r.projectCount} project{r.projectCount === 1 ? "" : "s"}
            </Text>
            <View style={{ height: 8, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 4, marginTop: 8, overflow: "hidden" }}>
              <View style={{ height: 8, width: `${Math.min(100, r.attainment)}%`, backgroundColor: tone === "success" ? "#16a34a" : tone === "blue" ? "#1e6ab0" : tone === "orange" ? "#f97316" : "#dc2626" }} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#64748b" }}>Target: {fmtAed(r.target)}</Text>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#16a34a" }}>Done: {fmtAed(r.achieved)}</Text>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#f97316" }}>Left: {r.target > 0 ? fmtAed(r.remaining) : "—"}</Text>
            </View>
          </Card>
        );
      })}
    </DashboardScreen>
  );
}
