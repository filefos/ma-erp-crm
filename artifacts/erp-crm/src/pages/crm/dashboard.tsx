import { useMemo } from "react";
import { Link } from "wouter";
import {
  useListLeads, useListContacts, useListDeals, useListActivities, useListQuotations,
} from "@workspace/api-client-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import {
  Users, Briefcase, Flame, CheckCircle2, AlertTriangle, Clock, TrendingUp, FileText, Sparkles,
  Phone, MessageCircle, ArrowRight, Activity as ActivityIcon, Trophy, Target, Calendar, BarChart3,
  Mail, ShoppingBag,
} from "lucide-react";
import { suggestNextAction } from "@/lib/ai-crm";
import {
  ExecutiveHeader, KPIWidget, StatusBadge, AIScoreBadge, Avatar,
  weeklyCounts, weeklyValues, trendPct, localDayKey,
} from "@/components/crm/premium";

const STAGE_LABELS: Record<string, string> = {
  new: "New", qualification: "Qualified", proposal: "Proposal",
  negotiation: "Negotiation", won: "Won", lost: "Lost",
};

const SOURCE_COLORS = ["#0f2d5a", "#1e6ab0", "#3b82f6", "#10b981", "#f97316", "#ef4444", "#8b5cf6", "#64748b"];

export function CRMDashboard() {
  const { data: leadsRaw } = useListLeads({});
  const { data: contactsRaw } = useListContacts({});
  const { data: dealsRaw } = useListDeals();
  const { data: activitiesRaw } = useListActivities();
  const { data: quotationsRaw } = useListQuotations();
  const { filterByCompany } = useActiveCompany();

  const leads = useMemo(() => filterByCompany(leadsRaw ?? []), [leadsRaw, filterByCompany]);
  const contacts = useMemo(() => filterByCompany(contactsRaw ?? []), [contactsRaw, filterByCompany]);
  const deals = useMemo(() => filterByCompany(dealsRaw ?? []), [dealsRaw, filterByCompany]);
  const activities = useMemo(() => filterByCompany(activitiesRaw ?? []), [activitiesRaw, filterByCompany]);
  const quotations = useMemo(() => filterByCompany(quotationsRaw ?? []), [quotationsRaw, filterByCompany]);

  const today = localDayKey();
  const monthStart = new Date(); monthStart.setDate(1);

  // --- KPIs ---
  const totalLeads = leads.length;
  const newLeadsThisMonth = leads.filter(l => l.createdAt && new Date(l.createdAt) >= monthStart).length;
  const hotLeads = leads.filter(l => l.leadScore === "hot").length;
  const activeLeads = leads.filter(l => !["won", "lost"].includes(l.status)).length;
  const wonLeads = leads.filter(l => l.status === "won").length;
  const activeDeals = deals.filter(d => !["won", "lost"].includes(d.stage)).length;
  const wonDeals = deals.filter(d => d.stage === "won").length;
  const lostDeals = deals.filter(d => d.stage === "lost").length;
  const pipelineValue = deals.filter(d => !["won", "lost"].includes(d.stage)).reduce((s, d) => s + Number(d.value ?? 0), 0);
  const wonValue = deals.filter(d => d.stage === "won").reduce((s, d) => s + Number(d.value ?? 0), 0);
  const quotationValue = quotations.reduce((s, q: any) => s + Number(q.grandTotal ?? 0), 0);
  const followUpsToday = leads.filter(l => l.nextFollowUp === today && !["won", "lost"].includes(l.status));
  const overdueFollowUps = leads.filter(l => l.nextFollowUp && l.nextFollowUp < today && !["won", "lost"].includes(l.status));
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

  // --- Sparklines (8 weekly buckets) ---
  const leadSpark = useMemo(() => weeklyCounts(leads, "createdAt", 8), [leads]);
  const hotSpark = useMemo(() => weeklyCounts(leads.filter(l => l.leadScore === "hot"), "createdAt", 8), [leads]);
  const dealSpark = useMemo(() => weeklyCounts(deals, "createdAt", 8), [deals]);
  const wonSpark = useMemo(() => weeklyValues(deals.filter(d => d.stage === "won"), "updatedAt", d => Number(d.value ?? 0), 8), [deals]);
  const quoteSpark = useMemo(() => weeklyValues(quotations, "createdAt", (q: any) => Number(q.grandTotal ?? 0), 8), [quotations]);
  // Daily series for follow-up + conversion KPIs (8 day buckets so the
  // sparkline reads "this week" rather than calendar weeks).
  const followUpsTodaySpark = useMemo(() => {
    const buckets = new Array(8).fill(0);
    const now = new Date();
    for (const l of leads) {
      if (!l.nextFollowUp || ["won", "lost"].includes(l.status)) continue;
      const t = new Date(l.nextFollowUp).getTime();
      const days = Math.floor((t - now.getTime()) / 86_400_000);
      const idx = 7 + days; // today=7, yesterday=6, +1=8 (skip)
      if (idx >= 0 && idx < 8) buckets[idx]++;
    }
    return buckets;
  }, [leads]);
  const overdueSpark = useMemo(() => {
    const buckets = new Array(8).fill(0);
    const now = new Date();
    for (const l of leads) {
      if (!l.nextFollowUp || ["won", "lost"].includes(l.status)) continue;
      const t = new Date(l.nextFollowUp).getTime();
      const days = Math.floor((now.getTime() - t) / 86_400_000);
      const idx = 7 - days;
      if (days > 0 && idx >= 0 && idx < 8) buckets[idx]++;
    }
    return buckets;
  }, [leads]);
  const conversionSpark = useMemo(() => {
    // Rolling 8-week conversion rate (won/total leads created in that week).
    const buckets = new Array(8).fill(0);
    const now = new Date();
    for (let i = 0; i < 8; i++) {
      const end   = new Date(now); end.setDate(now.getDate() - i * 7);
      const start = new Date(end); start.setDate(end.getDate() - 7);
      const inWindow = leads.filter(l => {
        const t = new Date(l.createdAt).getTime();
        return t >= start.getTime() && t < end.getTime();
      });
      const wonCount = inWindow.filter(l => l.status === "won").length;
      buckets[7 - i] = inWindow.length > 0 ? Math.round((wonCount / inWindow.length) * 100) : 0;
    }
    return buckets;
  }, [leads]);

  // --- Charts ---
  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leads) counts[l.source ?? "other"] = (counts[l.source ?? "other"] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  }, [leads]);

  // --- Revenue contribution per lead source (won deals + quoted value) ---
  const sourceRevenue = useMemo(() => {
    const m: Record<string, { source: string; won: number; quoted: number }> = {};
    const leadById = new Map(leads.map(l => [l.id, l]));
    for (const l of leads) {
      const k = (l.source ?? "other").replace(/_/g, " ");
      if (!m[k]) m[k] = { source: k, won: 0, quoted: 0 };
    }
    for (const d of deals as any[]) {
      const lead = d.leadId ? leadById.get(d.leadId) : undefined;
      const src = ((lead?.source ?? "other") as string).replace(/_/g, " ");
      if (!m[src]) m[src] = { source: src, won: 0, quoted: 0 };
      if (d.stage === "won") m[src].won += Number(d.value ?? 0);
    }
    for (const q of quotations as any[]) {
      const lead = q.leadId ? leadById.get(q.leadId) : undefined;
      const src = ((lead?.source ?? "other") as string).replace(/_/g, " ");
      if (!m[src]) m[src] = { source: src, won: 0, quoted: 0 };
      m[src].quoted += Number(q.grandTotal ?? 0);
    }
    return Object.values(m).filter(e => e.won > 0 || e.quoted > 0).sort((a, b) => (b.won + b.quoted) - (a.won + a.quoted));
  }, [leads, deals, quotations]);

  const pipelineData = useMemo(() => {
    const counts: Record<string, { count: number; value: number }> = {};
    for (const stage of Object.keys(STAGE_LABELS)) counts[stage] = { count: 0, value: 0 };
    for (const d of deals) {
      if (!counts[d.stage]) counts[d.stage] = { count: 0, value: 0 };
      counts[d.stage].count++;
      counts[d.stage].value += Number(d.value ?? 0);
    }
    return Object.entries(counts).map(([k, v]) => ({ stage: STAGE_LABELS[k] ?? k, deals: v.count, value: v.value }));
  }, [deals]);

  // --- Lists ---
  const recentActivities = useMemo(() => [...activities].slice(0, 6), [activities]);
  const topHotLeads = useMemo(
    () => leads.filter(l => l.leadScore === "hot" && !["won", "lost"].includes(l.status)).slice(0, 5),
    [leads],
  );

  // --- Executive AI insights (banner) ---
  const insights = useMemo(() => {
    const out: { tone: "red" | "amber" | "blue"; text: string }[] = [];
    const uncontactedHot = leads.filter(l => {
      const last = (l as any).lastContactedAt ?? l.updatedAt ?? l.createdAt;
      return l.leadScore === "hot"
        && !["won", "lost"].includes(l.status)
        && (!last || (Date.now() - new Date(last).getTime()) > 3 * 86_400_000);
    }).length;
    if (uncontactedHot > 0) out.push({ tone: "red",   text: `${uncontactedHot} hot lead${uncontactedHot === 1 ? "" : "s"} not contacted in 3+ days` });
    if (overdueFollowUps.length > 0) out.push({ tone: "red",   text: `${overdueFollowUps.length} follow-up${overdueFollowUps.length === 1 ? "" : "s"} overdue — clear them today` });
    const stuckDeals = deals.filter((d: any) => !["won", "lost"].includes(d.stage) && d.updatedAt && (Date.now() - new Date(d.updatedAt).getTime()) >= 7 * 86_400_000);
    if (stuckDeals.length > 0) out.push({ tone: "amber", text: `${stuckDeals.length} deal${stuckDeals.length === 1 ? "" : "s"} stuck for 7+ days in the pipeline` });
    const highValueAtRisk = deals.filter((d: any) => Number(d.value ?? 0) >= 500_000 && !["won", "lost"].includes(d.stage) && d.updatedAt && (Date.now() - new Date(d.updatedAt).getTime()) >= 5 * 86_400_000);
    if (highValueAtRisk.length > 0) out.push({ tone: "amber", text: `${highValueAtRisk.length} high-value deal${highValueAtRisk.length === 1 ? "" : "s"} need attention` });
    if (out.length === 0 && totalLeads > 0) out.push({ tone: "blue", text: "Your pipeline looks healthy — no critical issues detected." });
    return out.slice(0, 4);
  }, [leads, deals, overdueFollowUps, totalLeads]);

  // --- AI suggestions ---
  const aiSuggestions = useMemo(() => {
    const items: { lead: typeof leads[number]; suggestion: string }[] = [];
    for (const lead of overdueFollowUps.slice(0, 3)) items.push({ lead, suggestion: suggestNextAction(lead) });
    for (const lead of followUpsToday.slice(0, 3 - items.length)) items.push({ lead, suggestion: suggestNextAction(lead) });
    if (items.length < 3) {
      for (const lead of topHotLeads) {
        if (items.length >= 3) break;
        if (items.find(i => i.lead.id === lead.id)) continue;
        items.push({ lead, suggestion: suggestNextAction(lead) });
      }
    }
    return items;
  }, [overdueFollowUps, followUpsToday, topHotLeads]);

  return (
    <div className="space-y-5">
      <ExecutiveHeader
        icon={Sparkles}
        title="CRM Command Center"
        subtitle="Live executive view of leads, deals, follow-ups & pipeline"
      >
        <Button variant="secondary" size="sm" asChild className="bg-white/15 hover:bg-white/25 text-white border-0" data-testid="link-reports">
          <Link href="/crm/reports"><BarChart3 className="w-4 h-4 mr-1.5" />Reports</Link>
        </Button>
        <Button variant="secondary" size="sm" asChild className="bg-white/15 hover:bg-white/25 text-white border-0" data-testid="link-pipeline">
          <Link href="/crm/pipeline"><Briefcase className="w-4 h-4 mr-1.5" />Pipeline</Link>
        </Button>
        <Button variant="secondary" size="sm" asChild className="bg-white/15 hover:bg-white/25 text-white border-0" data-testid="link-sales">
          <Link href="/sales/dashboard"><ShoppingBag className="w-4 h-4 mr-1.5" />Sales Center</Link>
        </Button>
        <Button size="sm" asChild className="bg-white text-[#0f2d5a] hover:bg-white/90" data-testid="link-leads">
          <Link href="/crm/leads"><TrendingUp className="w-4 h-4 mr-1.5" />Open Leads</Link>
        </Button>
      </ExecutiveHeader>

      {/* AI Insights Banner */}
      {insights.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm" data-testid="banner-ai-insights">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#0f2d5a] to-[#1e6ab0]" />
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] flex items-center justify-center shadow">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-semibold">AI Executive Insights</h3>
            <Badge variant="secondary" className="text-[10px] bg-[#1e6ab0]/10 text-[#1e6ab0] border-0">live</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {insights.map((i, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm rounded-lg p-2 bg-muted/40">
                <div className={`w-2 h-2 rounded-full shrink-0 ${i.tone === "red" ? "bg-red-500" : i.tone === "amber" ? "bg-orange-500" : "bg-emerald-500"}`} />
                <span className="text-foreground/85">{i.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Grid — premium cards with sparklines + trends */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIWidget icon={Users}        tone="blue"   label="Total Leads"      value={totalLeads}                   sub={`${newLeadsThisMonth} new this month`}                href="/crm/leads"        sparkline={leadSpark}  trend={trendPct(leadSpark)}  testId="kpi-total-leads" />
        <KPIWidget icon={Flame}        tone="red"    label="Hot Leads"        value={hotLeads}                     sub={`${activeLeads} active`}                              href="/crm/leads"        sparkline={hotSpark}   trend={trendPct(hotSpark)}   testId="kpi-hot-leads" />
        <KPIWidget icon={Briefcase}    tone="amber"  label="Active Deals"     value={activeDeals}                  sub={`AED ${pipelineValue.toLocaleString()} pipeline`}     href="/crm/pipeline"     sparkline={dealSpark}  trend={trendPct(dealSpark)}  testId="kpi-active-deals" />
        <KPIWidget icon={Trophy}       tone="green"  label="Won Value"        value={`AED ${(wonValue / 1000).toFixed(0)}k`} sub={`${wonDeals} closed deals`}                  href="/crm/deals"        sparkline={wonSpark}   trend={trendPct(wonSpark)}   testId="kpi-won-value" />
        <KPIWidget icon={Calendar}     tone="indigo" label="Follow-ups Today" value={followUpsToday.length}         sub={overdueFollowUps.length ? `${overdueFollowUps.length} overdue` : "All on track"} href="/crm/follow-ups" sparkline={followUpsTodaySpark} testId="kpi-followups-today" />
        <KPIWidget icon={AlertTriangle} tone={overdueFollowUps.length ? "red" : "slate"} label="Overdue" value={overdueFollowUps.length} sub="Need action now" href="/crm/follow-ups" sparkline={overdueSpark} trend={trendPct(overdueSpark)} testId="kpi-overdue" />
        <KPIWidget icon={FileText}     tone="purple" label="Quotation Value"  value={`AED ${(quotationValue / 1000).toFixed(0)}k`} sub={`${quotations.length} quotations`}      href="/sales/quotations" sparkline={quoteSpark} trend={trendPct(quoteSpark)} testId="kpi-quote-value" />
        <KPIWidget icon={Target}       tone="teal"   label="Conversion"       value={`${conversionRate}%`}         sub={`${wonLeads}/${totalLeads} won`}                      href="/crm/reports"      sparkline={conversionSpark} trend={trendPct(conversionSpark)} testId="kpi-conversion" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Lead Sources" subtitle="Where your leads come from" icon={Users}>
          {sourceData.length === 0 ? (
            <Empty>No leads yet</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                  {sourceData.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Deal Pipeline" subtitle="Deals + value by stage" icon={Briefcase} className="lg:col-span-2" data-testid="card-deal-pipeline">
          {deals.length === 0 ? (
            <Empty>No deals yet — go to <Link href="/crm/pipeline" className="text-primary underline">Pipeline</Link></Empty>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={pipelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number, name: string) => name === "value" ? `AED ${v.toLocaleString()}` : v} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="deals" fill="#1e6ab0" name="Deals" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="value" fill="#0f2d5a" name="Value (AED)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Cross-sell: Leads with open quotations */}
      {(() => {
        const openStatuses = ["draft", "sent", "pending_approval"];
        const quotesByLead = new Map<number, any[]>();
        for (const q of quotations as any[]) {
          if (!q.leadId) continue;
          if (!openStatuses.includes((q.status ?? "").toLowerCase())) continue;
          const arr = quotesByLead.get(q.leadId) ?? [];
          arr.push(q);
          quotesByLead.set(q.leadId, arr);
        }
        const crossSell = leads
          .map((l: any) => {
            const qs = quotesByLead.get(l.id) ?? [];
            return { lead: l, openQuotes: qs.length, openValue: qs.reduce((s: number, q: any) => s + Number(q.grandTotal ?? 0), 0) };
          })
          .filter(x => x.openQuotes > 0)
          .sort((a, b) => b.openValue - a.openValue)
          .slice(0, 6);
        return (
          <Card title="Cross-Sell · Leads with Open Quotations" subtitle="Active opportunities awaiting client decision" icon={Sparkles} data-testid="card-cross-sell">
            {crossSell.length === 0 ? (
              <Empty>No leads have open quotations right now.</Empty>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {crossSell.map(x => (
                  <Link key={x.lead.id} href={`/crm/leads/${x.lead.id}`} className="block">
                    <div className="border rounded-xl p-3 hover:bg-muted/40 hover:border-[#1e6ab0]/40 transition-all">
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar name={x.lead.leadName ?? x.lead.companyName ?? "?"} size={28} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{x.lead.leadName ?? x.lead.companyName}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{x.lead.contactPerson ?? x.lead.companyName ?? "—"}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <Badge className="bg-[#1e6ab0]/10 text-[#1e6ab0] text-[10px]">{x.openQuotes} open quote{x.openQuotes === 1 ? "" : "s"}</Badge>
                        <div className="text-sm font-bold text-[#0f2d5a] dark:text-white">AED {(x.openValue / 1000).toFixed(0)}k</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        );
      })()}

      {/* Revenue per Lead Source */}
      <Card title="Revenue per Lead Source" subtitle="Won-deal value + quoted value, grouped by acquisition channel" icon={Target}>
        {sourceRevenue.length === 0 ? (
          <Empty>No source-attributed revenue yet.</Empty>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={sourceRevenue} layout="vertical" margin={{ left: 30, right: 30 }} data-testid="chart-source-revenue">
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <YAxis dataKey="source" type="category" tick={{ fontSize: 11 }} width={100} />
              <Tooltip formatter={(v: number) => `AED ${v.toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="won"    stackId="rev" fill="#10b981" name="Won deals"   radius={[0, 0, 0, 0]} />
              <Bar dataKey="quoted" stackId="rev" fill="#1e6ab0" name="Quoted value" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Lower row: AI suggestions, follow-ups, recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* AI Suggested Actions */}
        <div className="bg-card border rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] flex items-center justify-center shadow">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold">AI Suggested Actions</div>
              <div className="text-[11px] text-muted-foreground">Top moves to make today</div>
            </div>
          </div>
          {aiSuggestions.length === 0 ? (
            <Empty>You're all caught up.</Empty>
          ) : (
            <div className="space-y-2">
              {aiSuggestions.map(({ lead, suggestion }) => (
                <Link key={lead.id} href={`/crm/leads/${lead.id}`} className="block group">
                  <div className="border rounded-xl p-2.5 hover:bg-muted/40 hover:border-[#1e6ab0]/40 cursor-pointer transition-all">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-xs font-mono text-primary">{lead.leadNumber}</span>
                      <StatusBadge status={lead.status} />
                    </div>
                    <div className="text-sm font-medium leading-tight truncate">{lead.leadName}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{suggestion}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Follow-ups Today / Overdue */}
        <div className="bg-card border rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <div className="text-sm font-semibold">Follow-ups</div>
              <div className="text-[11px] text-muted-foreground">{followUpsToday.length} today · {overdueFollowUps.length} overdue</div>
            </div>
          </div>
          <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
            {[...overdueFollowUps, ...followUpsToday].slice(0, 8).map(lead => {
              const isOverdue = lead.nextFollowUp! < today;
              return (
                <Link key={lead.id} href={`/crm/leads/${lead.id}`} className="block">
                  <div className="border rounded-xl p-2 hover:bg-muted/40 hover:border-[#1e6ab0]/40 cursor-pointer flex items-center gap-2 transition-all">
                    <div className={`w-1.5 h-9 rounded-full shrink-0 ${isOverdue ? "bg-red-500" : "bg-orange-500"}`} />
                    <Avatar name={lead.leadName} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{lead.leadName}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {isOverdue ? "OVERDUE " : ""}{lead.nextFollowUp} · {lead.requirementType ?? "—"}
                      </div>
                    </div>
                    {lead.whatsapp && (
                      <a href={`https://wa.me/${lead.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-green-600 hover:text-green-700" aria-label={`WhatsApp ${lead.leadName}`}>
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    )}
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} className="text-blue-600 hover:text-blue-700" aria-label={`Call ${lead.leadName}`}>
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </Link>
              );
            })}
            {followUpsToday.length === 0 && overdueFollowUps.length === 0 && <Empty>No follow-ups due.</Empty>}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card border rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <ActivityIcon className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Recent Activity</div>
              <div className="text-[11px] text-muted-foreground">Latest CRM touchpoints</div>
            </div>
            <Link href="/crm/activities" className="text-[11px] text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {recentActivities.length === 0 ? <Empty>No activities yet.</Empty> : recentActivities.map((a: any) => (
              <div key={a.id} className="flex items-start gap-2 text-sm">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${a.isDone ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                  {a.isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.subject}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">
                    {a.type?.replace(/_/g, " ")} · {a.dueDate || (a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hot Leads strip */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-sm font-semibold">Top Hot Leads</h3>
            <Badge variant="secondary" className="text-[10px]">{topHotLeads.length}</Badge>
          </div>
          <Link href="/crm/leads" className="text-[11px] text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
        </div>
        {topHotLeads.length === 0 ? <Empty>No hot leads at the moment.</Empty> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {topHotLeads.map(l => (
              <Link key={l.id} href={`/crm/leads/${l.id}`} className="block">
                <div className="border rounded-xl p-3 hover:bg-muted/40 hover:border-red-300 hover:shadow-md cursor-pointer transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <Avatar name={l.leadName} size={28} />
                    <AIScoreBadge score="hot" />
                  </div>
                  <div className="text-sm font-semibold truncate">{l.leadName}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{l.companyName ?? "—"}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-emerald-600 font-medium">
                      {l.budget ? `AED ${Number(l.budget).toLocaleString()}` : "Budget TBC"}
                    </span>
                    <span className="text-[10px] font-mono text-primary">{l.leadNumber}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FooterStat label="Contacts" value={contacts.length} href="/crm/contacts" icon={Users} />
        <FooterStat label="Lost Deals" value={lostDeals} href="/crm/deals" icon={Target} />
        <FooterStat label="Open Quotations" value={quotations.length} href="/sales/quotations" icon={Mail} />
      </div>
    </div>
  );
}

// ---- Sub-components ----

function Card({ title, subtitle, icon: Icon, children, className = "", "data-testid": testId }: {
  title: string; subtitle?: string; icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode; className?: string; "data-testid"?: string;
}) {
  return (
    <div className={`bg-card border rounded-2xl p-4 space-y-3 shadow-sm ${className}`} data-testid={testId}>
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

function FooterStat({ label, value, href, icon: Icon }: {
  label: string; value: number | string; href: string; icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href} className="block">
      <div className="bg-card border rounded-xl p-3 hover:bg-muted/40 hover:border-[#1e6ab0]/40 cursor-pointer flex items-center gap-3 transition-all">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <div className="text-sm"><span className="font-bold mr-1">{value}</span><span className="text-muted-foreground">{label}</span></div>
      </div>
    </Link>
  );
}
