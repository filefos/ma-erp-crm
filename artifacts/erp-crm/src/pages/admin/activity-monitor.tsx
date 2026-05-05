import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Activity, Clock, Eye, TrendingUp, User, RefreshCw, ChevronRight } from "lucide-react";
import { authHeaders } from "@/lib/ai-client";

const BASE = import.meta.env.BASE_URL;

type Session = {
  id: number; userId: number; userName: string | null; uniqueUserId: string | null;
  loginAt: string; logoutAt: string | null; lastHeartbeatAt: string | null;
  activeSeconds: number; idleSeconds: number; focusLostCount: number;
  totalSeconds: number; efficiency: number; sessionMinutes: number | null;
  ipAddress: string | null;
};

type UserDetail = {
  user: { id: number; name: string; email: string; role: string | null; uniqueUserId: string | null; userCode: string | null };
  sessions: Session[];
  moduleBreakdown: Record<string, number>;
  totalActive: number; totalIdle: number; totalSessions: number; efficiency: number;
};

function fmt(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function efficiencyBadge(e: number) {
  if (e >= 70) return <Badge className="bg-green-100 text-green-800">{e}% High</Badge>;
  if (e >= 40) return <Badge className="bg-yellow-100 text-yellow-800">{e}% Medium</Badge>;
  return <Badge className="bg-red-100 text-red-800">{e}% Low</Badge>;
}

function sessionStatus(s: Session) {
  if (s.logoutAt) return <Badge variant="outline" className="text-gray-500">Ended</Badge>;
  if (s.lastHeartbeatAt) {
    const stale = Date.now() - new Date(s.lastHeartbeatAt).getTime() > 120_000;
    if (stale) return <Badge variant="outline" className="text-orange-500">Inactive</Badge>;
    return <Badge className="bg-green-100 text-green-800">Active</Badge>;
  }
  return <Badge variant="outline">Unknown</Badge>;
}

const MODULE_LABELS: Record<string, string> = {
  crm: "CRM", sales: "Sales", accounts: "Accounts", procurement: "Procurement",
  inventory: "Inventory", projects: "Projects", hr: "HR", assets: "Assets",
  auth: "Auth", finance: "Finance", quotations: "Quotations", invoices: "Invoices",
  expenses: "Expenses", employees: "Employees", purchase_orders: "Purchase Orders",
};

export function ActivityMonitor() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [filterUserId, setFilterUserId] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterUserId.trim()) params.set("userId", filterUserId.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const r = await fetch(`${BASE}api/activity/sessions?${params}`, { headers: authHeaders() });
    if (r.ok) setSessions(await r.json());
    setLoading(false);
  }

  async function openDetail(userId: number) {
    setLoadingDetail(true);
    const r = await fetch(`${BASE}api/activity/users/${userId}/detail`, { headers: authHeaders() });
    if (r.ok) setSelectedUser(await r.json());
    setLoadingDetail(false);
  }

  useEffect(() => { load(); }, []);

  // ── User Detail View ─────────────────────────────────────────────────────
  if (selectedUser) {
    const u = selectedUser.user;
    const totalSecs = selectedUser.totalActive + selectedUser.totalIdle;
    const effLabel = totalSecs > 0
      ? `User worked ${fmt(selectedUser.totalActive)} out of ${fmt(totalSecs)} (${selectedUser.efficiency}% efficiency – ${selectedUser.efficiency >= 70 ? "High focus" : selectedUser.efficiency >= 40 ? "Medium focus" : "Low focus"})`
      : "No session data yet.";

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold">{u.name}</h1>
            <p className="text-sm text-muted-foreground">{u.email} · {u.uniqueUserId ?? u.userCode ?? `User #${u.id}`} · {u.role}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Total Sessions</div><div className="text-2xl font-bold text-[#0f2d5a]">{selectedUser.totalSessions}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Active Time</div><div className="text-2xl font-bold text-green-700">{fmt(selectedUser.totalActive)}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Idle Time</div><div className="text-2xl font-bold text-orange-600">{fmt(selectedUser.totalIdle)}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Efficiency</div><div className="text-2xl font-bold">{selectedUser.efficiency}%</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#c9a14a]" />AI Productivity Analysis</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{effLabel}</p>
            {selectedUser.efficiency < 40 && (
              <Badge className="mt-2 bg-red-100 text-red-800">⚠ Low Productivity Flagged</Badge>
            )}
            {selectedUser.totalIdle > selectedUser.totalActive && (
              <Badge className="mt-2 ml-2 bg-orange-100 text-orange-800">⚠ High Idle Time</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Module Activity Breakdown</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(selectedUser.moduleBreakdown).length === 0 ? (
              <p className="text-sm text-muted-foreground">No module activity recorded yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(selectedUser.moduleBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([mod, count]) => (
                    <div key={mod} className="flex items-center gap-1 border rounded px-3 py-1.5 bg-slate-50 text-sm">
                      <span className="font-medium">{MODULE_LABELS[mod] ?? mod}</span>
                      <Badge variant="secondary">{count} actions</Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Session History</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Login</TableHead>
                  <TableHead>Logout</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Idle</TableHead>
                  <TableHead>Focus Lost</TableHead>
                  <TableHead>Efficiency</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedUser.sessions.map(s => {
                  const total = s.activeSeconds + s.idleSeconds;
                  const eff = total > 0 ? Math.round((s.activeSeconds / total) * 100) : 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(s.loginAt).toLocaleString()}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{s.logoutAt ? new Date(s.logoutAt).toLocaleString() : "—"}</TableCell>
                      <TableCell className="text-xs">{s.sessionMinutes != null ? `${s.sessionMinutes}m` : "—"}</TableCell>
                      <TableCell className="text-xs text-green-700">{fmt(s.activeSeconds)}</TableCell>
                      <TableCell className="text-xs text-orange-600">{fmt(s.idleSeconds)}</TableCell>
                      <TableCell className="text-xs">{s.focusLostCount}</TableCell>
                      <TableCell>{efficiencyBadge(eff)}</TableCell>
                      <TableCell>{sessionStatus(s as any)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main Dashboard ───────────────────────────────────────────────────────
  const totalActive = sessions.reduce((s, r) => s + r.activeSeconds, 0);
  const totalSessions = sessions.length;
  const avgEfficiency = sessions.length
    ? Math.round(sessions.reduce((s, r) => s + r.efficiency, 0) / sessions.length)
    : 0;
  const activeSessions = sessions.filter(s => !s.logoutAt && s.lastHeartbeatAt && Date.now() - new Date(s.lastHeartbeatAt).getTime() < 120_000).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="w-6 h-6 text-[#c9a14a]" />User Activity Monitor
        </h1>
        <p className="text-muted-foreground text-sm">Real-time login, working time, and productivity tracking. Admin access only.</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="w-3 h-3" />Active Now</div><div className="text-2xl font-bold text-green-700">{activeSessions}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />Total Sessions</div><div className="text-2xl font-bold text-[#0f2d5a]">{totalSessions}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" />Active Work Time</div><div className="text-2xl font-bold">{fmt(totalActive)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="w-3 h-3" />Avg Efficiency</div><div className="text-2xl font-bold">{avgEfficiency}%</div></CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">User ID</label>
              <Input placeholder="User DB id..." value={filterUserId} onChange={e => setFilterUserId(e.target.value)} className="h-8 w-32" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">From</label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 w-36" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">To</label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 w-36" />
            </div>
            <Button size="sm" onClick={load} disabled={loading} className="bg-[#0f2d5a] hover:bg-[#163d76]">
              <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Loading..." : "Apply"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Session table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Session Log</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Login Time</TableHead>
                <TableHead>Logout Time</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Idle</TableHead>
                <TableHead>Focus Lost</TableHead>
                <TableHead>Efficiency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading sessions…</TableCell></TableRow>
              ) : sessions.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No sessions found for the selected date range.</TableCell></TableRow>
              ) : sessions.map(s => (
                <TableRow key={s.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openDetail(s.userId)}>
                  <TableCell>
                    <span className="font-mono text-xs bg-[#0f2d5a] text-white px-2 py-0.5 rounded">
                      {s.uniqueUserId ?? `USR-${s.userId}`}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium flex items-center gap-1">
                    <User className="w-3 h-3 text-muted-foreground" />
                    {s.userName ?? `User #${s.userId}`}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(s.loginAt).toLocaleString()}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{s.logoutAt ? new Date(s.logoutAt).toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-xs">{s.sessionMinutes != null ? `${s.sessionMinutes}m` : "—"}</TableCell>
                  <TableCell className="text-xs text-green-700 font-medium">{fmt(s.activeSeconds)}</TableCell>
                  <TableCell className="text-xs text-orange-600">{fmt(s.idleSeconds)}</TableCell>
                  <TableCell className="text-xs text-center">{s.focusLostCount}</TableCell>
                  <TableCell>{efficiencyBadge(s.efficiency)}</TableCell>
                  <TableCell>{sessionStatus(s)}</TableCell>
                  <TableCell>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {loadingDetail && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 text-sm">Loading user detail…</div>
        </div>
      )}
    </div>
  );
}
