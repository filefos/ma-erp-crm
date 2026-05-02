import { useMemo } from "react";
import { Link } from "wouter";
import { useListEmployees, useListAttendance, useListUsers } from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart as RPieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import {
  HardHat, Users, Clock, CheckCircle2, XCircle, AlertTriangle, MapPin,
  TrendingUp, ArrowRight, Sparkles, UserCheck, UserPlus, Award, Globe2,
} from "lucide-react";
import {
  ExecutiveHeader, KPIWidget, Avatar, weeklyValues, trendPct,
} from "@/components/crm/premium";

const PALETTE = ["#1e6ab0", "#0f2d5a", "#10b981", "#f97316", "#8b5cf6", "#06b6d4", "#ef4444", "#14b8a6", "#a855f7", "#64748b"];

function localDayKey(raw?: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function HrDashboard() {
  const { filterByCompany } = useActiveCompany();
  const { data: employeesRaw }   = useListEmployees({});
  const { data: attendanceRaw }  = useListAttendance({});
  const { data: usersRaw }       = useListUsers();

  const employees  = useMemo(() => filterByCompany(employeesRaw ?? []), [employeesRaw, filterByCompany]);
  const attendance = useMemo(() => attendanceRaw ?? [], [attendanceRaw]);
  const users      = usersRaw ?? [];

  const today = localDayKey(new Date().toISOString())!;

  // Filter attendance to in-company employees (attendance records may not have companyId directly)
  const employeeIds = useMemo(() => new Set(employees.map((e: any) => e.id)), [employees]);
  const myAttendance = useMemo(
    () => (attendance as any[]).filter(a => employeeIds.has(a.employeeId)),
    [attendance, employeeIds],
  );

  // ---- KPIs ----
  const totalEmployees   = employees.length;
  const activeEmployees  = employees.filter((e: any) => e.isActive !== false).length;
  const labourCount      = employees.filter((e: any) => (e.type ?? "").toLowerCase() === "labour").length;
  const staffCount       = employees.filter((e: any) => (e.type ?? "").toLowerCase() === "staff").length;
  const newJoinersThisMonth = useMemo(() => {
    const monthStart = new Date(); monthStart.setDate(1);
    return employees.filter((e: any) => e.joiningDate && new Date(e.joiningDate) >= monthStart).length;
  }, [employees]);

  const todayAttendance = myAttendance.filter(a => a.date === today);
  const presentToday = todayAttendance.filter(a => ["present", "checked_in", "in"].includes((a.status ?? "").toLowerCase())).length;
  const absentToday  = todayAttendance.filter(a => ["absent"].includes((a.status ?? "").toLowerCase())).length;
  const lateToday    = todayAttendance.filter(a => ["late"].includes((a.status ?? "").toLowerCase())).length;
  const halfDayToday = todayAttendance.filter(a => ["half_day", "halfday", "half-day"].includes((a.status ?? "").toLowerCase())).length;
  const onLeaveToday = todayAttendance.filter(a => ["leave", "on_leave"].includes((a.status ?? "").toLowerCase())).length;
  const attendancePct = activeEmployees > 0 ? Math.round((presentToday / activeEmployees) * 100) : 0;
  const overtimeToday = todayAttendance.reduce((s, a) => s + Number(a.overtime ?? 0), 0);

  // ---- Sparklines ----
  const employeesSpark = useMemo(() => weeklyValues(employees, "createdAt", () => 1, 8), [employees]);
  const presentSpark = useMemo(() => {
    // Daily counts for the last 8 days
    const buckets = new Array(8).fill(0);
    const now = new Date();
    for (const a of myAttendance) {
      if (!a.date) continue;
      const t = new Date(a.date).getTime();
      const days = Math.floor((now.getTime() - t) / 86_400_000);
      const idx = 7 - days;
      if (idx >= 0 && idx < 8 && ["present", "checked_in", "in"].includes((a.status ?? "").toLowerCase())) {
        buckets[idx]++;
      }
    }
    return buckets;
  }, [myAttendance]);

  // ---- Department distribution ----
  const departmentMix = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of employees as any[]) {
      const k = e.departmentName ?? "Unassigned";
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [employees]);

  // ---- Nationality breakdown (top 8) ----
  const nationalityMix = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of employees as any[]) {
      const k = e.nationality ?? "—";
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [employees]);

  // ---- Site breakdown ----
  const siteMix = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of employees as any[]) {
      const k = e.siteLocation ?? "—";
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [employees]);

  // ---- 14-day attendance trend ----
  const attendanceTrend = useMemo(() => {
    const days: { day: string; present: number; absent: number; late: number; leave: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = localDayKey(d.toISOString())!;
      const dayRecords = myAttendance.filter(a => a.date === key);
      days.push({
        day: d.toLocaleDateString("en-AE", { weekday: "short", day: "2-digit" }),
        present: dayRecords.filter(a => ["present", "checked_in", "in"].includes((a.status ?? "").toLowerCase())).length,
        absent:  dayRecords.filter(a => (a.status ?? "").toLowerCase() === "absent").length,
        late:    dayRecords.filter(a => (a.status ?? "").toLowerCase() === "late").length,
        leave:   dayRecords.filter(a => ["leave", "on_leave"].includes((a.status ?? "").toLowerCase())).length,
      });
    }
    return days;
  }, [myAttendance]);

  // ---- Top performers (by present days last 30 days) ----
  const topPerformers = useMemo(() => {
    const m: Record<number, { id: number; name: string; presentDays: number; lateDays: number; overtime: number }> = {};
    const cutoff = Date.now() - 30 * 86_400_000;
    for (const a of myAttendance) {
      if (!a.date) continue;
      const t = new Date(a.date).getTime();
      if (t < cutoff) continue;
      const e = employees.find((x: any) => x.id === a.employeeId);
      if (!e) continue;
      const entry = m[e.id] ?? { id: e.id, name: e.name, presentDays: 0, lateDays: 0, overtime: 0 };
      const status = (a.status ?? "").toLowerCase();
      if (["present", "checked_in", "in"].includes(status)) entry.presentDays++;
      if (status === "late") entry.lateDays++;
      entry.overtime += Number(a.overtime ?? 0);
      m[e.id] = entry;
    }
    return Object.values(m).sort((a, b) => b.presentDays - a.presentDays).slice(0, 6);
  }, [myAttendance, employees]);

  // ---- Birthdays & work anniversaries (this calendar month only) ----
  const upcomingDates = useMemo(() => {
    const now = new Date();
    const monthIdx = now.getMonth();
    const year     = now.getFullYear();
    const out: { id: number; name: string; kind: "birthday" | "anniversary"; date: Date; days: number; years?: number }[] = [];
    for (const e of employees as any[]) {
      const push = (raw: string | null | undefined, kind: "birthday" | "anniversary") => {
        if (!raw) return;
        const d = new Date(raw);
        if (isNaN(d.getTime())) return;
        // Only celebrate dates that fall within the current calendar month.
        if (d.getMonth() !== monthIdx) return;
        const next = new Date(year, monthIdx, d.getDate());
        const days = Math.ceil((next.getTime() - now.setHours(0, 0, 0, 0)) / 86_400_000);
        const years = kind === "anniversary" ? year - d.getFullYear() : undefined;
        out.push({ id: e.id, name: e.name, kind, date: next, days, years });
      };
      push(e.dateOfBirth ?? e.dob, "birthday");
      push(e.joiningDate, "anniversary");
    }
    return out.sort((a, b) => a.days - b.days).slice(0, 12);
  }, [employees]);

  // ---- Recent attendance feed (today + yesterday, latest first) ----
  const recentAttendance = useMemo(() => {
    const cutoff = Date.now() - 2 * 86_400_000;
    return (myAttendance as any[])
      .filter(a => a.date && new Date(a.date).getTime() >= cutoff)
      .map(a => {
        const e = employees.find((x: any) => x.id === a.employeeId);
        return { ...a, name: e?.name ?? `Employee #${a.employeeId}`, designation: e?.designation };
      })
      .sort((a, b) => (b.checkInTime ?? b.date ?? "").localeCompare(a.checkInTime ?? a.date ?? ""))
      .slice(0, 10);
  }, [myAttendance, employees]);

  // ---- Insights ----
  const insights = useMemo(() => {
    const out: { tone: "red" | "amber" | "blue"; text: string }[] = [];
    if (absentToday > activeEmployees * 0.1 && activeEmployees > 0) out.push({ tone: "red", text: `${absentToday} absent today (${Math.round((absentToday / activeEmployees) * 100)}% of workforce)` });
    if (lateToday > 0) out.push({ tone: "amber", text: `${lateToday} employee${lateToday === 1 ? "" : "s"} late today` });
    const stale = employees.filter((e: any) => e.isActive !== false && !myAttendance.some(a => a.employeeId === e.id && a.date === today)).length;
    if (stale > 0 && activeEmployees > 0) out.push({ tone: "amber", text: `${stale} employee${stale === 1 ? "" : "s"} have not checked in today` });
    if (newJoinersThisMonth > 0) out.push({ tone: "blue", text: `Welcome ${newJoinersThisMonth} new joiner${newJoinersThisMonth === 1 ? "" : "s"} this month` });
    if (out.length === 0 && totalEmployees > 0) out.push({ tone: "blue", text: "Workforce running smoothly — no critical HR alerts." });
    return out.slice(0, 4);
  }, [absentToday, lateToday, newJoinersThisMonth, employees, myAttendance, today, activeEmployees, totalEmployees]);

  return (
    <div className="space-y-5">
      <ExecutiveHeader
        icon={HardHat}
        title="HR Command Center"
        subtitle="Workforce · Attendance · Performance · Demographics"
      >
        <Button size="sm" variant="secondary" asChild className="bg-white/15 hover:bg-white/25 text-white border-0">
          <Link href="/hr/attendance"><Clock className="w-4 h-4 mr-1.5" />Attendance</Link>
        </Button>
        <Button size="sm" asChild className="bg-white text-[#0f2d5a] hover:bg-white/90">
          <Link href="/hr/employees"><Users className="w-4 h-4 mr-1.5" />Employees</Link>
        </Button>
      </ExecutiveHeader>

      {insights.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#0f2d5a] to-[#1e6ab0]" />
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] flex items-center justify-center shadow">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-semibold">HR Insights · Today</h3>
            <Badge variant="secondary" className="text-[10px] bg-[#1e6ab0]/10 text-[#1e6ab0] border-0">live</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {insights.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm rounded-lg p-2 bg-muted/40">
                <div className={`w-2 h-2 rounded-full shrink-0 ${r.tone === "red" ? "bg-red-500" : r.tone === "amber" ? "bg-orange-500" : "bg-emerald-500"}`} />
                <span className="text-foreground/85">{r.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIWidget icon={Users}        tone="navy"   label="Total Workforce"    value={totalEmployees}       sub={`${activeEmployees} active`}                  sparkline={employeesSpark} trend={trendPct(employeesSpark)} href="/hr/employees" testId="kpi-total-employees" />
        <KPIWidget icon={HardHat}      tone="amber"  label="Labour"             value={labourCount}          sub={`${staffCount} staff`}                        href="/hr/employees" testId="kpi-labour" />
        <KPIWidget icon={UserCheck}    tone="green"  label="Present Today"      value={presentToday}         sub={`${attendancePct}% attendance`}               sparkline={presentSpark} trend={trendPct(presentSpark)} href="/hr/attendance" testId="kpi-present" />
        <KPIWidget icon={XCircle}      tone={absentToday > 0 ? "red" : "slate"} label="Absent Today" value={absentToday} sub={`${onLeaveToday} on leave`} href="/hr/attendance" testId="kpi-absent" />
        <KPIWidget icon={AlertTriangle} tone={lateToday > 0 ? "amber" : "slate"} label="Late Today" value={lateToday} sub={`${halfDayToday} half-day`} href="/hr/attendance" testId="kpi-late" />
        <KPIWidget icon={Clock}        tone="purple" label="Overtime Hours"     value={overtimeToday.toFixed(1)} sub="Today's total"                            href="/hr/attendance" testId="kpi-overtime" />
        <KPIWidget icon={UserPlus}     tone="teal"   label="New Joiners (MTD)"  value={newJoinersThisMonth}  sub="This month"                                  href="/hr/employees" testId="kpi-joiners" />
        <KPIWidget icon={Globe2}       tone="indigo" label="Nationalities"      value={nationalityMix.length} sub="Diverse workforce"                          testId="kpi-nationalities" />
      </div>

      {/* Attendance trend */}
      <div className="bg-card border rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-semibold">14-Day Attendance Trend</div>
            <div className="text-[11px] text-muted-foreground">Present · Late · Absent · On Leave</div>
          </div>
        </div>
        {attendanceTrend.every(d => d.present === 0 && d.absent === 0 && d.late === 0 && d.leave === 0) ? (
          <Empty>No attendance records yet.</Empty>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={attendanceTrend}>
              <defs>
                <linearGradient id="grad-present" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} fill="url(#grad-present)" name="Present" />
              <Area type="monotone" dataKey="late"    stroke="#f97316" strokeWidth={2} fillOpacity={0}        name="Late" />
              <Area type="monotone" dataKey="absent"  stroke="#ef4444" strokeWidth={2} fillOpacity={0}        name="Absent" />
              <Area type="monotone" dataKey="leave"   stroke="#1e6ab0" strokeWidth={2} fillOpacity={0}        name="On Leave" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Demographics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PanelCard title="Department" subtitle="Workforce by department" icon={Users}>
          {departmentMix.length === 0 ? (
            <Empty>No employees yet.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={departmentMix} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip />
                <Bar dataKey="value" fill="#1e6ab0" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </PanelCard>

        <PanelCard title="Nationality" subtitle="Top nationalities" icon={Globe2}>
          {nationalityMix.length === 0 ? (
            <Empty>No nationalities recorded.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <RPieChart>
                <Pie data={nationalityMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                  {nationalityMix.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </RPieChart>
            </ResponsiveContainer>
          )}
        </PanelCard>

        <PanelCard title="Site Locations" subtitle="Where the workforce is deployed" icon={MapPin}>
          {siteMix.length === 0 ? (
            <Empty>No site assignments.</Empty>
          ) : (
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
              {siteMix.map((s, i) => {
                const max = siteMix[0].value;
                return (
                  <div key={s.name} className="flex items-center gap-2">
                    <div className="text-xs font-medium truncate flex-1 min-w-0">{s.name}</div>
                    <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#0f2d5a] to-[#1e6ab0]" style={{ width: `${(s.value / max) * 100}%` }} />
                    </div>
                    <div className="text-xs font-semibold w-8 text-right">{s.value}</div>
                  </div>
                );
              })}
            </div>
          )}
        </PanelCard>
      </div>

      {/* Birthdays + Recent Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PanelCard title="Birthdays & Anniversaries" subtitle="This month · celebrate your team" icon={Award}>
          {upcomingDates.length === 0 ? (
            <Empty>No birthdays or anniversaries this month.</Empty>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto" data-testid="list-birthdays">
              {upcomingDates.map(u => (
                <div key={`${u.kind}-${u.id}`} className="border rounded-xl p-2.5 hover:bg-muted/40 transition-all flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${u.kind === "birthday" ? "bg-pink-100 text-pink-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {u.kind === "birthday" ? <Sparkles className="w-4 h-4" /> : <Award className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {u.kind === "birthday" ? "Birthday" : `${u.years}-year work anniversary`} · {u.date.toLocaleDateString("en-AE", { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                  <Badge className={u.days === 0 ? "bg-emerald-100 text-emerald-700" : u.days < 0 ? "bg-slate-100 text-slate-600" : u.days <= 7 ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}>
                    {u.days === 0 ? "Today" : u.days < 0 ? `${Math.abs(u.days)}d ago` : `in ${u.days}d`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        <PanelCard title="Recent Attendance" subtitle="Latest check-ins (last 48h)" icon={Clock}>
          {recentAttendance.length === 0 ? (
            <Empty>No attendance records in the last 48 hours.</Empty>
          ) : (
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto" data-testid="list-recent-attendance">
              {recentAttendance.map((a: any) => {
                const status = (a.status ?? "").toLowerCase();
                const tone = status === "present" || status === "checked_in" || status === "in" ? "emerald"
                  : status === "late" ? "orange"
                  : status === "absent" ? "red" : "blue";
                const colorMap: Record<string, string> = {
                  emerald: "bg-emerald-100 text-emerald-700",
                  orange:  "bg-orange-100 text-orange-700",
                  red:     "bg-red-100 text-red-700",
                  blue:    "bg-blue-100 text-blue-700",
                };
                return (
                  <Link key={a.id} href="/hr/attendance" className="block">
                    <div className="border rounded-xl p-2.5 hover:bg-muted/40 transition-all flex items-center gap-3">
                      <Avatar name={a.name} size={28} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{a.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {a.date} {a.checkInTime ? `· in ${new Date(a.checkInTime).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}` : ""}
                          {a.checkOutTime ? ` · out ${new Date(a.checkOutTime).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}` : ""}
                        </div>
                      </div>
                      <Badge className={`text-[10px] capitalize ${colorMap[tone]}`}>{(a.status ?? "—").replace(/_/g, " ")}</Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </PanelCard>
      </div>

      {/* Top performers */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] flex items-center justify-center shadow">
              <Award className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold">Top Performers · Last 30 Days</div>
              <div className="text-[11px] text-muted-foreground">Most present days, lowest tardiness</div>
            </div>
          </div>
          <Link href="/hr/attendance" className="text-[11px] text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {topPerformers.length === 0 ? (
          <Empty>No attendance data for the last 30 days.</Empty>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {topPerformers.map((p, i) => (
              <div key={p.id} className="border rounded-xl p-3 hover:bg-muted/40 transition-all flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${i === 0 ? "bg-gradient-to-br from-amber-500 to-orange-600" : i === 1 ? "bg-gradient-to-br from-slate-400 to-slate-500" : i === 2 ? "bg-gradient-to-br from-orange-400 to-amber-700" : "bg-[#1e6ab0]"}`}>
                  {i + 1}
                </div>
                <Avatar name={p.name} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.presentDays} present · {p.lateDays} late · {p.overtime.toFixed(1)}h OT
                  </div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PanelCard({ title, subtitle, icon: Icon, children }: {
  title: string; subtitle?: string; icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border rounded-2xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground italic py-6 text-center">{children}</div>;
}
