import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart as RPieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import {
  Mail, Inbox, Send, Star, FileText, Trash2, ArrowRight, Sparkles,
  TrendingUp, Users, Reply, Calendar,
} from "lucide-react";
import {
  ExecutiveHeader, KPIWidget, weeklyValues, trendPct, Avatar,
} from "@/components/crm/premium";
import { useActiveCompany } from "@/hooks/useActiveCompany";

interface Email {
  id: number;
  folder: string;
  fromAddress: string;
  fromName?: string;
  toAddress: string;
  toName?: string;
  subject: string;
  body: string;
  isRead: boolean;
  isStarred: boolean;
  replyToId?: number;
  sentAt?: string;
  createdAt: string;
}

const BASE = import.meta.env.BASE_URL;

async function apiFetch(path: string) {
  const token = localStorage.getItem("erp_token");
  const res = await fetch(`${BASE}api${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const FOLDERS = ["inbox", "sent", "draft", "trash", "starred"] as const;

const FOLDER_COLORS: Record<string, string> = {
  inbox: "#1e6ab0", sent: "#10b981", draft: "#64748b", trash: "#ef4444", starred: "#f97316",
};

export function EmailDashboard() {
  const { activeCompanyId } = useActiveCompany();
  const queries = FOLDERS.map(folder =>
    useQuery<Email[]>({
      queryKey: ["emails", folder, activeCompanyId],
      queryFn: () => apiFetch(`/emails?folder=${folder}&companyId=${activeCompanyId}`),
      retry: 1,
      staleTime: 30_000,
    }),
  );

  const isLoading = queries.some(q => q.isLoading);

  const byFolder = useMemo(() => {
    const m: Record<string, Email[]> = {};
    FOLDERS.forEach((f, i) => { m[f] = queries[i].data ?? []; });
    return m;
  }, [queries.map(q => q.data).join("|")]);

  const inboxAll = byFolder.inbox ?? [];
  const sentAll  = byFolder.sent  ?? [];
  const drafts   = byFolder.draft ?? [];
  const trash    = byFolder.trash ?? [];
  const starred  = byFolder.starred ?? [];

  // KPI numbers
  const unread        = inboxAll.filter(e => !e.isRead).length;
  const inboxCount    = inboxAll.length;
  const sentCount     = sentAll.length;
  const draftCount    = drafts.length;
  const starredCount  = starred.length;
  const trashCount    = trash.length;
  const replyRatio    = inboxCount > 0 ? Math.round((sentAll.filter(e => e.replyToId).length / inboxCount) * 100) : 0;

  // ---- Sparklines (8 weeks) ----
  const inboxSpark  = useMemo(() => weeklyValues(inboxAll, "createdAt", () => 1, 8), [inboxAll]);
  const sentSpark   = useMemo(() => weeklyValues(sentAll,  "sentAt",   () => 1, 8), [sentAll]);

  // ---- Volume trend (last 7 days) ----
  const volumeTrend = useMemo(() => {
    const days: { day: string; received: number; sent: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end   = new Date(d); end.setHours(23, 59, 59, 999);
      const inRange = (raw?: string) => {
        if (!raw) return false;
        const t = new Date(raw).getTime();
        return t >= start.getTime() && t <= end.getTime();
      };
      days.push({
        day: d.toLocaleDateString("en-AE", { weekday: "short", day: "2-digit" }),
        received: inboxAll.filter(e => inRange(e.createdAt)).length,
        sent:     sentAll.filter(e => inRange(e.sentAt ?? e.createdAt)).length,
      });
    }
    return days;
  }, [inboxAll, sentAll]);

  // ---- Folder distribution ----
  const folderMix = useMemo(() => FOLDERS.map(f => ({
    name: f,
    value: (byFolder[f] ?? []).length,
  })).filter(e => e.value > 0), [byFolder]);

  // ---- Top senders (inbox) ----
  const topSenders = useMemo(() => {
    const m: Record<string, { name: string; address: string; count: number; unread: number }> = {};
    for (const e of inboxAll) {
      const key = e.fromAddress;
      const ent = m[key] ?? { name: e.fromName ?? e.fromAddress, address: e.fromAddress, count: 0, unread: 0 };
      ent.count++;
      if (!e.isRead) ent.unread++;
      m[key] = ent;
    }
    return Object.values(m).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [inboxAll]);

  // ---- Top recipients (sent) ----
  const topRecipients = useMemo(() => {
    const m: Record<string, { name: string; address: string; count: number }> = {};
    for (const e of sentAll) {
      const key = e.toAddress;
      const ent = m[key] ?? { name: e.toName ?? e.toAddress, address: e.toAddress, count: 0 };
      ent.count++;
      m[key] = ent;
    }
    return Object.values(m).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [sentAll]);

  // ---- Most-active threads (group by normalized subject across inbox + sent) ----
  const activeThreads = useMemo(() => {
    const norm = (s: string) => (s ?? "").trim().replace(/^(re|fw|fwd):\s*/gi, "").toLowerCase();
    const m: Record<string, { subject: string; count: number; participants: Set<string>; latest: string; unread: number }> = {};
    for (const e of [...inboxAll, ...sentAll]) {
      const k = norm(e.subject) || "(no subject)";
      const ent = m[k] ?? { subject: e.subject || "(no subject)", count: 0, participants: new Set<string>(), latest: e.sentAt ?? e.createdAt, unread: 0 };
      ent.count++;
      ent.participants.add(e.fromAddress);
      ent.participants.add(e.toAddress);
      const t = e.sentAt ?? e.createdAt;
      if ((t ?? "") > ent.latest) ent.latest = t;
      if (!e.isRead && e.folder === "inbox") ent.unread++;
      m[k] = ent;
    }
    return Object.values(m)
      .filter(t => t.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map(t => ({ ...t, participantCount: t.participants.size }));
  }, [inboxAll, sentAll]);

  // ---- Recent activity ----
  const recentActivity = useMemo(() => {
    const all = [
      ...inboxAll.map(e => ({ ...e, kind: "in" as const })),
      ...sentAll.map(e =>  ({ ...e, kind: "out" as const })),
    ];
    return all
      .sort((a, b) => (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt))
      .slice(0, 8);
  }, [inboxAll, sentAll]);

  // ---- Insights ----
  const insights = useMemo(() => {
    const out: { tone: "red" | "amber" | "blue"; text: string }[] = [];
    if (unread > 20) out.push({ tone: "red", text: `${unread} unread emails — clean up your inbox` });
    else if (unread > 0) out.push({ tone: "amber", text: `${unread} unread email${unread === 1 ? "" : "s"} waiting` });
    if (draftCount > 0) out.push({ tone: "amber", text: `${draftCount} draft${draftCount === 1 ? "" : "s"} pending — finish or discard` });
    const cutoff = Date.now() - 7 * 86_400_000;
    const oldUnread = inboxAll.filter(e => !e.isRead && new Date(e.createdAt).getTime() < cutoff).length;
    if (oldUnread > 0) out.push({ tone: "amber", text: `${oldUnread} unread email${oldUnread === 1 ? "" : "s"} older than 7 days` });
    if (out.length === 0 && inboxCount > 0) out.push({ tone: "blue", text: "Inbox is clean — keep it up." });
    return out.slice(0, 4);
  }, [unread, draftCount, inboxAll, inboxCount]);

  return (
    <div className="space-y-5">
      <ExecutiveHeader
        icon={Mail}
        title="Email Command Center"
        subtitle="Inbox · Sent · Drafts · Engagement Metrics"
      >
        <Button size="sm" variant="secondary" asChild className="bg-white/15 hover:bg-white/25 text-white border-0">
          <Link href="/email"><Inbox className="w-4 h-4 mr-1.5" />Open Inbox</Link>
        </Button>
        <Button size="sm" asChild className="bg-white text-[#0f2d5a] hover:bg-white/90">
          <Link href="/email"><Send className="w-4 h-4 mr-1.5" />Compose</Link>
        </Button>
      </ExecutiveHeader>

      {insights.length > 0 && !isLoading && (
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#0f2d5a] to-[#1e6ab0]" />
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] flex items-center justify-center shadow">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-semibold">Email Insights</h3>
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
        <KPIWidget icon={Inbox}    tone="navy"   label="Inbox"           value={inboxCount}   sub={`${unread} unread`}            sparkline={inboxSpark} trend={trendPct(inboxSpark)} href="/email" testId="kpi-inbox" />
        <KPIWidget icon={Send}     tone="green"  label="Sent"            value={sentCount}    sub="All time"                      sparkline={sentSpark}  trend={trendPct(sentSpark)}  href="/email" testId="kpi-sent" />
        <KPIWidget icon={FileText} tone="slate"  label="Drafts"          value={draftCount}   sub="Unsent compositions"           href="/email" testId="kpi-drafts" />
        <KPIWidget icon={Star}     tone="amber"  label="Starred"         value={starredCount} sub="Important emails"              href="/email" testId="kpi-starred" />
        <KPIWidget icon={Mail}     tone={unread > 0 ? "blue" : "slate"} label="Unread" value={unread} sub="Need your attention"   href="/email" testId="kpi-unread" />
        <KPIWidget icon={Reply}    tone="purple" label="Reply Rate"      value={`${replyRatio}%`} sub={`${sentAll.filter(e => e.replyToId).length} replies sent`} href="/email" testId="kpi-reply" />
        <KPIWidget icon={Trash2}   tone="slate"  label="Trash"           value={trashCount}   sub="Auto-cleared periodically"     href="/email" testId="kpi-trash" />
        <KPIWidget icon={Users}    tone="indigo" label="Unique Senders"  value={topSenders.length === 6 ? "6+" : topSenders.length} sub="In your inbox"      testId="kpi-senders" />
      </div>

      {/* Volume trend + folder mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PanelCard title="14-Day Email Volume" subtitle="Received vs sent per day" icon={TrendingUp} className="lg:col-span-2">
          {volumeTrend.every(d => d.received === 0 && d.sent === 0) ? (
            <Empty>No email activity in the last 14 days.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={volumeTrend}>
                <defs>
                  <linearGradient id="grad-recv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#1e6ab0" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#1e6ab0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-sent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="received" stroke="#1e6ab0" strokeWidth={2} fill="url(#grad-recv)" name="Received" />
                <Area type="monotone" dataKey="sent"     stroke="#10b981" strokeWidth={2} fill="url(#grad-sent)" name="Sent" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </PanelCard>

        <PanelCard title="Folder Distribution" subtitle="Where your emails live" icon={Mail}>
          {folderMix.length === 0 ? (
            <Empty>No emails yet.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <RPieChart>
                <Pie data={folderMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                  {folderMix.map((e, i) => <Cell key={i} fill={FOLDER_COLORS[e.name] ?? "#1e6ab0"} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RPieChart>
            </ResponsiveContainer>
          )}
        </PanelCard>
      </div>

      {/* Top senders + recipients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PanelCard title="Top Senders" subtitle="Who's emailing you the most" icon={Users}>
          {topSenders.length === 0 ? (
            <Empty>No inbox emails yet.</Empty>
          ) : (
            <div className="space-y-2">
              {topSenders.map(s => (
                <div key={s.address} className="border rounded-xl p-2.5 hover:bg-muted/40 transition-all flex items-center gap-3">
                  <Avatar name={s.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{s.address}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold">{s.count}</div>
                    {s.unread > 0 && <Badge className="bg-blue-100 text-blue-700 text-[10px]">{s.unread} unread</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        <PanelCard title="Top Recipients" subtitle="Who you email the most" icon={Send}>
          {topRecipients.length === 0 ? (
            <Empty>No sent emails yet.</Empty>
          ) : (
            <div className="space-y-2">
              {topRecipients.map(r => (
                <div key={r.address} className="border rounded-xl p-2.5 hover:bg-muted/40 transition-all flex items-center gap-3">
                  <Avatar name={r.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{r.address}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold">{r.count}</div>
                    <div className="text-[10px] text-muted-foreground">sent</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      </div>

      {/* Most-active threads */}
      <PanelCard title="Most-Active Threads" subtitle="Conversations with the most back-and-forth" icon={Reply}>
        {activeThreads.length === 0 ? (
          <Empty>No multi-message threads yet.</Empty>
        ) : (
          <div className="space-y-2" data-testid="list-active-threads">
            {activeThreads.map(t => (
              <Link key={t.subject} href="/email" className="block">
                <div className="border rounded-xl p-2.5 hover:bg-muted/40 hover:border-[#1e6ab0]/40 transition-all flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] flex items-center justify-center text-white shrink-0">
                    <Reply className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.subject}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {t.count} message{t.count === 1 ? "" : "s"} · {t.participantCount} participant{t.participantCount === 1 ? "" : "s"} · last {new Date(t.latest).toLocaleDateString("en-AE", { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge className="bg-[#1e6ab0]/10 text-[#1e6ab0] text-[10px]">{t.count}×</Badge>
                    {t.unread > 0 && <Badge className="bg-blue-100 text-blue-700 text-[10px]">{t.unread} unread</Badge>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </PanelCard>

      {/* Recent activity */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-semibold">Recent Email Activity</div>
              <div className="text-[11px] text-muted-foreground">Latest 8 emails across inbox & sent</div>
            </div>
          </div>
          <Link href="/email" className="text-[11px] text-primary hover:underline flex items-center gap-1">
            Open Email <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <Empty>No email activity yet.</Empty>
        ) : (
          <div className="space-y-1.5">
            {recentActivity.map(e => {
              const isInbound = e.kind === "in";
              const display = isInbound ? (e.fromName ?? e.fromAddress) : (e.toName ?? e.toAddress);
              return (
                <Link key={`${e.kind}-${e.id}`} href="/email" className="block">
                  <div className="border rounded-xl p-2.5 hover:bg-muted/40 hover:border-[#1e6ab0]/40 transition-all flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isInbound ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {isInbound ? <Inbox className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{display}</span>
                        {!e.isRead && isInbound && <Badge className="bg-blue-100 text-blue-700 text-[9px]">NEW</Badge>}
                        {e.isStarred && <Star className="w-3 h-3 text-orange-500 fill-orange-500" />}
                      </div>
                      <div className="text-[12px] text-muted-foreground truncate">{e.subject || "(no subject)"}</div>
                    </div>
                    <div className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(e.sentAt ?? e.createdAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PanelCard({ title, subtitle, icon: Icon, children, className = "" }: {
  title: string; subtitle?: string; icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-card border rounded-2xl p-4 space-y-3 shadow-sm ${className}`}>
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
