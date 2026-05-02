import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProjects, useListUsers, useListSalesTargets,
  useCreateSalesTarget, useUpdateSalesTarget, useDeleteSalesTarget,
  getListSalesTargetsQueryKey,
} from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Target, TrendingUp, Trophy, Users, ArrowLeft, Plus, Trash2, Calendar, MapPin, Briefcase,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const stageColors: Record<string, string> = {
  new_project:  "bg-blue-100 text-blue-800",
  production:   "bg-purple-100 text-purple-800",
  procurement:  "bg-orange-100 text-orange-800",
  delivery:     "bg-cyan-100 text-cyan-800",
  installation: "bg-orange-100 text-orange-800",
  testing:      "bg-violet-100 text-violet-800",
  handover:     "bg-teal-100 text-teal-800",
  completed:    "bg-green-100 text-green-800",
};

function fmtAED(v: number) {
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `AED ${(v / 1_000).toFixed(0)}k`;
  return `AED ${Math.round(v).toLocaleString()}`;
}

function isProjectInPeriod(p: any, year: number, month?: number): boolean {
  // Use startDate if present, else createdAt — both are reliable signals of when work began.
  const raw = p.startDate || p.createdAt;
  if (!raw) return false;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return false;
  if (d.getFullYear() !== year) return false;
  if (month != null && d.getMonth() + 1 !== month) return false;
  return true;
}

export function SalesPerformance() {
  const queryClient = useQueryClient();
  const { activeCompanyId, filterByCompany } = useActiveCompany();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | "all">(now.getMonth() + 1);

  const { data: projectsRaw, isLoading: lp } = useListProjects({});
  const { data: usersRaw } = useListUsers();
  // Fetch all targets for the year (any period) so monthly/quarterly/yearly can each contribute.
  const { data: targetsRaw } = useListSalesTargets({ year });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListSalesTargetsQueryKey() });
  const createTarget = useCreateSalesTarget({ mutation: { onSuccess: invalidate } });
  const updateTarget = useUpdateSalesTarget({ mutation: { onSuccess: invalidate } });
  const deleteTarget = useDeleteSalesTarget({ mutation: { onSuccess: invalidate } });

  const projects = useMemo(() => filterByCompany(projectsRaw ?? []), [projectsRaw, filterByCompany]);
  const targets  = useMemo(() => filterByCompany(targetsRaw  ?? []), [targetsRaw,  filterByCompany]);
  const salesUsers = useMemo(() => (usersRaw ?? []).filter((u: any) => {
    const r = (u.role ?? "").toLowerCase();
    return r === "sales" || r.includes("sales") || r === "main_admin" || r === "admin" || r === "manager";
  }), [usersRaw]);

  const periodLabel = month === "all" ? `${year}` : `${MONTHS[(month as number) - 1]} ${year}`;

  // Build rows: for each salesperson, target (matching year+month) and achieved (sum of project values within period assigned to them)
  const rows = useMemo(() => {
    const monthFilter = month === "all" ? undefined : (month as number);
    return salesUsers.map((u: any) => {
      const myProjects = projects.filter((p: any) =>
        p.salespersonId === u.id && isProjectInPeriod(p, year, monthFilter),
      );
      const achieved = myProjects.reduce((s: number, p: any) => s + Number(p.projectValue ?? 0), 0);
      // Match target: same user, same year. When a specific month is selected, sum the monthly
      // target for that month + a 1/3 share of its quarterly target + 1/12 of the yearly target.
      // When "Full Year" is selected, sum every target for the year (yearly + all monthly + all
      // quarterly) so admins can set targets at any granularity without double-counting drift.
      const userYearTargets = targets.filter((t: any) => t.userId === u.id && t.year === year);
      let target = 0;
      if (monthFilter != null) {
        const q = Math.ceil(monthFilter / 3);
        for (const t of userYearTargets as any[]) {
          if (t.period === "monthly" && t.month === monthFilter)        target += Number(t.targetAmount ?? 0);
          else if (t.period === "quarterly" && t.quarter === q)         target += Number(t.targetAmount ?? 0) / 3;
          else if (t.period === "yearly")                                target += Number(t.targetAmount ?? 0) / 12;
        }
      } else {
        target = userYearTargets.reduce((s: number, t: any) => s + Number(t.targetAmount ?? 0), 0);
      }
      const matchedTargets = userYearTargets.filter((t: any) => {
        if (monthFilter == null) return true;
        const q = Math.ceil(monthFilter / 3);
        return (t.period === "monthly" && t.month === monthFilter)
          || (t.period === "quarterly" && t.quarter === q)
          || (t.period === "yearly");
      });
      const remaining = Math.max(0, target - achieved);
      const attainment = target > 0 ? Math.min(999, Math.round((achieved / target) * 100)) : 0;
      return {
        id: u.id, name: u.name, role: u.role,
        target, achieved, remaining, attainment,
        projects: myProjects,
        targetIds: matchedTargets.map((t: any) => t.id),
      };
    }).sort((a, b) => b.achieved - a.achieved);
  }, [salesUsers, projects, targets, year, month]);

  const teamTarget    = rows.reduce((s, r) => s + r.target, 0);
  const teamAchieved  = rows.reduce((s, r) => s + r.achieved, 0);
  const teamRemaining = Math.max(0, teamTarget - teamAchieved);
  const teamAttain    = teamTarget > 0 ? Math.round((teamAchieved / teamTarget) * 100) : 0;
  const totalProjects = rows.reduce((s, r) => s + r.projects.length, 0);

  const chartData = rows.slice(0, 8).map(r => ({
    name: (r.name ?? "").split(" ")[0] || "—",
    Target: r.target,
    Achieved: r.achieved,
  }));

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-[#1e6ab0]" />Sales Performance
          </h1>
          <p className="text-muted-foreground text-sm">
            Salesperson targets vs achieved · projects, timeline & remaining target — {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" asChild>
            <Link href="/projects"><ArrowLeft className="w-4 h-4 mr-1.5" />Projects</Link>
          </Button>
          <SetTargetDialog
            users={salesUsers}
            companyId={activeCompanyId}
            defaultYear={year}
            defaultMonth={month === "all" ? now.getMonth() + 1 : (month as number)}
            onSubmit={(v) => createTarget.mutate({ data: v })}
          />
        </div>
      </div>

      {/* Period filters */}
      <div className="flex items-center gap-2 flex-wrap bg-card border rounded-xl p-3">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground mr-1">Period</span>
        <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
          <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(month)} onValueChange={(v) => setMonth(v === "all" ? "all" : parseInt(v, 10))}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Full Year</SelectItem>
            {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Team KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile icon={Target}     label="Team Target"    value={fmtAED(teamTarget)}    tone="navy"  />
        <KpiTile icon={Trophy}     label="Achieved"       value={fmtAED(teamAchieved)}  tone="green" sub={`${teamAttain}% of target`} />
        <KpiTile icon={TrendingUp} label="Remaining"      value={fmtAED(teamRemaining)} tone="amber" sub={`${100 - Math.min(100, teamAttain)}% to go`} />
        <KpiTile icon={Briefcase}  label="Active Projects" value={totalProjects}        tone="blue"  sub={`${rows.length} salespeople`} />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Target vs Achieved (top 8)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip formatter={(v: number) => `AED ${v.toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Target"   fill="#0f2d5a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Achieved" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Salesperson rows */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" />Salesperson Performance</CardTitle>
          <span className="text-xs text-muted-foreground">{rows.length} salespeople · {periodLabel}</span>
        </CardHeader>
        <CardContent className="space-y-4">
          {lp ? (
            <div className="text-center text-sm text-muted-foreground py-8">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8 italic">No sales users yet.</div>
          ) : rows.map(r => (
            <SalespersonRow
              key={r.id}
              row={r}
              onDeleteTargets={() => r.targetIds.forEach((id: number) => deleteTarget.mutate({ id }))}
              onUpdateTarget={(amount) => {
                if (r.targetIds.length === 1) {
                  updateTarget.mutate({ id: r.targetIds[0], data: {
                    companyId: activeCompanyId, userId: r.id,
                    period: month === "all" ? "yearly" : "monthly",
                    year, month: month === "all" ? undefined : (month as number),
                    targetAmount: amount,
                  } });
                } else {
                  // Replace: delete existing, create new (consolidated)
                  r.targetIds.forEach((id: number) => deleteTarget.mutate({ id }));
                  createTarget.mutate({ data: {
                    companyId: activeCompanyId, userId: r.id,
                    period: month === "all" ? "yearly" : "monthly",
                    year, month: month === "all" ? undefined : (month as number),
                    targetAmount: amount,
                  } });
                }
              }}
            />
          ))}
        </CardContent>
      </Card>

      {/* All targets table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">All Targets ({year})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Salesperson</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Month/Qtr</TableHead>
                <TableHead className="text-right">Target (AED)</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground italic">No targets set for {year}.</TableCell></TableRow>
              ) : targets.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.userName ?? `User #${t.userId}`}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{t.period}</Badge></TableCell>
                  <TableCell>{t.year}</TableCell>
                  <TableCell>{t.month ? MONTHS[t.month - 1] : t.quarter ? `Q${t.quarter}` : "—"}</TableCell>
                  <TableCell className="text-right font-semibold text-[#1e6ab0]">{Number(t.targetAmount).toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{t.notes ?? "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteTarget.mutate({ id: t.id })}>
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SalespersonRow({
  row, onUpdateTarget, onDeleteTargets,
}: {
  row: { id: number; name: string; role: string; target: number; achieved: number; remaining: number; attainment: number; projects: any[]; targetIds: number[] };
  onUpdateTarget: (amount: number) => void;
  onDeleteTargets: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(row.target || ""));

  const status = row.attainment >= 100 ? "exceeded" : row.attainment >= 75 ? "on track" : row.attainment >= 40 ? "behind" : "at risk";
  const statusColor = row.attainment >= 100 ? "bg-emerald-500" : row.attainment >= 75 ? "bg-blue-500" : row.attainment >= 40 ? "bg-orange-500" : "bg-red-500";

  return (
    <div className="border rounded-xl p-4 bg-card hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0 ${statusColor}`}>
            {(row.name ?? "?").split(" ").slice(0, 2).map(p => p[0] ?? "").join("").toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{row.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="capitalize text-[10px]">{row.role.replace(/_/g, " ")}</Badge>
              <Badge variant="secondary" className="capitalize text-[10px]">{status}</Badge>
              <span className="text-[11px] text-muted-foreground">{row.projects.length} project{row.projects.length === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs text-right items-center">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Target</div>
            {editing ? (
              <div className="flex items-center gap-1">
                <Input value={draft} onChange={e => setDraft(e.target.value)} className="h-7 text-xs w-24 text-right" />
                <Button size="sm" className="h-7 px-2 text-[10px]" onClick={() => { onUpdateTarget(Number(draft) || 0); setEditing(false); }}>Save</Button>
              </div>
            ) : (
              <div className="font-bold text-sm cursor-pointer hover:text-[#1e6ab0]" onClick={() => { setDraft(String(row.target || "")); setEditing(true); }}>
                {row.target > 0 ? fmtAED(row.target) : "Set →"}
              </div>
            )}
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Achieved</div>
            <div className="font-bold text-sm text-emerald-700">{fmtAED(row.achieved)}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Remaining</div>
            <div className="font-bold text-sm text-orange-700">{row.target > 0 ? fmtAED(row.remaining) : "—"}</div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 flex items-center gap-3">
        <Progress value={Math.min(100, row.attainment)} className="h-2 flex-1" />
        <span className="text-xs font-bold w-14 text-right text-[#1e6ab0]">{row.attainment}%</span>
      </div>

      {/* Toggle projects */}
      {row.projects.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-[#1e6ab0] font-medium hover:underline">
            {expanded ? "Hide" : "Show"} projects ({row.projects.length})
          </button>
          {expanded && (
            <div className="mt-2 border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Project No.</TableHead>
                    <TableHead className="text-xs">Project / Client</TableHead>
                    <TableHead className="text-xs">Location</TableHead>
                    <TableHead className="text-xs">Stage</TableHead>
                    <TableHead className="text-xs">Start</TableHead>
                    <TableHead className="text-xs">Finish</TableHead>
                    <TableHead className="text-xs">Delivery</TableHead>
                    <TableHead className="text-right text-xs">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {row.projects.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <Link href={`/projects/${p.id}`} className="text-primary hover:underline">{p.projectNumber}</Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-xs">{p.projectName}</div>
                        <div className="text-[10px] text-muted-foreground">{p.clientName}</div>
                      </TableCell>
                      <TableCell className="text-xs"><span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-muted-foreground" />{p.location || "—"}</span></TableCell>
                      <TableCell><Badge variant="secondary" className={`text-[10px] ${stageColors[p.stage] ?? ""}`}>{p.stage?.replace("_", " ")}</Badge></TableCell>
                      <TableCell className="text-xs">{p.startDate || "—"}</TableCell>
                      <TableCell className="text-xs">{p.endDate || "—"}</TableCell>
                      <TableCell className="text-xs">{p.deliveryDate || "—"}</TableCell>
                      <TableCell className="text-right text-xs font-semibold">AED {Number(p.projectValue ?? 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {row.targetIds.length > 0 && (
        <div className="mt-2 text-right">
          <button onClick={onDeleteTargets} className="text-[10px] text-red-600 hover:underline">Clear target</button>
        </div>
      )}
    </div>
  );
}

function KpiTile({
  icon: Icon, label, value, tone, sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; sub?: string;
  tone: "navy" | "blue" | "green" | "amber";
}) {
  const styles = {
    navy:  { bg: "bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] text-white", icon: "bg-white/15 text-white" },
    blue:  { bg: "bg-card border", icon: "bg-blue-100 text-blue-700" },
    green: { bg: "bg-card border", icon: "bg-emerald-100 text-emerald-700" },
    amber: { bg: "bg-card border", icon: "bg-orange-100 text-orange-700" },
  }[tone];
  const isNavy = tone === "navy";
  return (
    <div className={`rounded-xl p-4 ${styles.bg} shadow-sm`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${styles.icon}`}><Icon className="w-5 h-5" /></div>
        <div className="min-w-0">
          <div className={`text-xl font-bold leading-none ${isNavy ? "text-white" : ""}`}>{value}</div>
          <div className={`text-xs mt-1 ${isNavy ? "text-white/80" : "text-muted-foreground"}`}>{label}</div>
          {sub && <div className={`text-[10px] mt-0.5 ${isNavy ? "text-white/60" : "text-muted-foreground/70"}`}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function SetTargetDialog({
  users, companyId, defaultYear, defaultMonth, onSubmit,
}: {
  users: any[];
  companyId: number;
  defaultYear: number;
  defaultMonth: number;
  onSubmit: (v: { companyId: number; userId: number; period: string; year: number; month?: number; quarter?: number; targetAmount: number; notes?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [period, setPeriod] = useState<string>("monthly");
  const [year, setYear]   = useState<number>(defaultYear);
  const [month, setMonth] = useState<number>(defaultMonth);
  const [quarter, setQuarter] = useState<number>(1);
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const submit = () => {
    if (!userId || !amount) return;
    onSubmit({
      companyId, userId: parseInt(userId, 10), period, year,
      month:   period === "monthly"   ? month   : undefined,
      quarter: period === "quarterly" ? quarter : undefined,
      targetAmount: Number(amount),
      notes: notes || undefined,
    });
    setOpen(false);
    setUserId(""); setAmount(""); setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#163d76]"><Plus className="w-4 h-4 mr-1.5" />Set Target</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Set Sales Target</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Salesperson</label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select salesperson..." /></SelectTrigger>
              <SelectContent>
                {users.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Period</label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Year</label>
              <Input type="number" value={year} onChange={e => setYear(parseInt(e.target.value, 10) || defaultYear)} className="h-9" />
            </div>
          </div>
          {period === "monthly" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Month</label>
              <Select value={String(month)} onValueChange={v => setMonth(parseInt(v, 10))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {period === "quarterly" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Quarter</label>
              <Select value={String(quarter)} onValueChange={v => setQuarter(parseInt(v, 10))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{[1,2,3,4].map(q => <SelectItem key={q} value={String(q)}>{`Q${q}`}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Target Amount (AED)</label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="500000" className="h-9" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-9" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!userId || !amount} className="bg-[#0f2d5a] hover:bg-[#163d76]">Save Target</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
