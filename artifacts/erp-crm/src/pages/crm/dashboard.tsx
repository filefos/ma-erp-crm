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
  Phone, MessageCircle, Calendar, ArrowRight, Activity as ActivityIcon, Trophy, Target,
} from "lucide-react";
import { suggestNextAction } from "@/lib/ai-crm";

const STAGE_LABELS: Record<string, string> = {
  new: "New", qualification: "Qualified", proposal: "Proposal",
  negotiation: "Negotiation", won: "Won", lost: "Lost",
};

const SOURCE_COLORS = ["#0f2d5a", "#1e6ab0", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];

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

  const today = new Date().toISOString().slice(0, 10);
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

  // --- Charts ---
  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leads) counts[l.source ?? "other"] = (counts[l.source ?? "other"] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  }, [leads]);

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
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CRM Command Center</h1>
          <p className="text-muted-foreground text-sm">Live executive view of leads, deals, follow-ups and pipeline.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild data-testid="link-pipeline">
            <Link href="/crm/pipeline"><Briefcase className="w-4 h-4 mr-1.5" />Sales Pipeline</Link>
          </Button>
          <Button size="sm" className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" asChild data-testid="link-leads">
            <Link href="/crm/leads"><TrendingUp className="w-4 h-4 mr-1.5" />Open Leads</Link>
          </Button>
        </div>
      </div>

      {/* AI Insights Banner */}
      {insights.length > 0 && (
        <div className="bg-gradient-to-r from-[#0f2d5a] to-[#1e6ab0] rounded-xl p-4 text-white" data-testid="banner-ai-insights">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4" />
            <h3 className="text-sm font-semibold">AI Executive Insights</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {insights.map((i, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm bg-white/10 rounded-lg p-2 backdrop-blur-sm">
                <div className={`w-2 h-2 rounded-full shrink-0 ${i.tone === "red" ? "bg-red-300" : i.tone === "amber" ? "bg-amber-300" : "bg-emerald-300"}`} />
                <span className="text-white/95">{i.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
        <Kpi icon={Users}        label="Total Leads"           value={totalLeads}                tone="blue"   sub={`${newLeadsThisMonth} new this month`} href="/crm/leads" />
        <Kpi icon={Flame}        label="Hot Leads"             value={hotLeads}                  tone="red"    sub={`${activeLeads} active`} href="/crm/leads" />
        <Kpi icon={Briefcase}    label="Active Deals"          value={activeDeals}               tone="amber"  sub={`AED ${pipelineValue.toLocaleString()} pipeline`} href="/crm/pipeline" />
        <Kpi icon={Trophy}       label="Won Deals"             value={wonDeals}                  tone="green"  sub={`AED ${wonValue.toLocaleString()} closed`} href="/crm/deals" />
        <Kpi icon={Calendar}     label="Follow-ups Today"      value={followUpsToday.length}     tone="indigo" sub={overdueFollowUps.length ? `${overdueFollowUps.length} overdue` : "All on track"} href="/crm/leads" />
        <Kpi icon={AlertTriangle} label="Overdue"              value={overdueFollowUps.length}   tone={overdueFollowUps.length ? "red" : "slate"} sub="Need action now" href="/crm/leads" />
        <Kpi icon={FileText}     label="Quotation Value"       value={`AED ${(quotationValue / 1000).toFixed(0)}k`} tone="purple" sub={`${quotations.length} quotations`} href="/sales/quotations" />
        <Kpi icon={Target}       label="Conversion"            value={`${conversionRate}%`}      tone="teal"   sub={`${wonLeads}/${totalLeads} won`} href="/reports" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Lead Sources" subtitle="Where your leads come from" icon={Users}>
          {sourceData.length === 0 ? (
            <Empty>No leads yet</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={2}>
                  {sourceData.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Deal Pipeline" subtitle="Deals + value by stage" icon={Briefcase} className="lg:col-span-2">
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

      {/* Lower row: AI suggestions, follow-ups, recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* AI Suggested Actions */}
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0f2d5a] to-[#1e6ab0] flex items-center justify-center">
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
                <Link key={lead.id} href={`/crm/leads/${lead.id}`} className="block">
                  <div className="border rounded-lg p-2.5 hover:bg-muted/30 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-primary">{lead.leadNumber}</span>
                      <Badge variant="secondary" className="text-[10px] capitalize">{lead.status?.replace(/_/g, " ")}</Badge>
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
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
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
                  <div className="border rounded-lg p-2 hover:bg-muted/30 cursor-pointer flex items-center gap-2">
                    <div className={`w-1.5 h-8 rounded-full shrink-0 ${isOverdue ? "bg-red-500" : "bg-amber-500"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{lead.leadName}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {isOverdue ? "OVERDUE " : ""}{lead.nextFollowUp} · {lead.requirementType ?? "—"}
                      </div>
                    </div>
                    {lead.whatsapp && (
                      <a href={`https://wa.me/${lead.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-green-600 hover:text-green-700">
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    )}
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} className="text-blue-600 hover:text-blue-700">
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
        <div className="bg-card border rounded-xl p-4 space-y-3">
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
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-semibold">Top Hot Leads</h3>
            <Badge variant="secondary" className="text-[10px]">{topHotLeads.length}</Badge>
          </div>
          <Link href="/crm/leads" className="text-[11px] text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
        </div>
        {topHotLeads.length === 0 ? <Empty>No hot leads at the moment.</Empty> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {topHotLeads.map(l => (
              <Link key={l.id} href={`/crm/leads/${l.id}`} className="block">
                <div className="border rounded-lg p-3 hover:bg-muted/30 cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-mono text-primary">{l.leadNumber}</span>
                    <Flame className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  <div className="text-sm font-semibold truncate">{l.leadName}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{l.companyName ?? "—"}</div>
                  <div className="text-[11px] text-emerald-600 font-medium mt-1">
                    {l.budget ? `AED ${Number(l.budget).toLocaleString()}` : "Budget TBC"}
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
        <FooterStat label="Open Quotations" value={quotations.length} href="/sales/quotations" icon={FileText} />
      </div>
    </div>
  );
}

// ---- Sub-components ----

const TONE_BG: Record<string, string> = {
  blue:   "bg-blue-100 text-blue-700",   red:    "bg-red-100 text-red-700",
  amber:  "bg-amber-100 text-amber-700", green:  "bg-emerald-100 text-emerald-700",
  indigo: "bg-indigo-100 text-indigo-700", purple: "bg-purple-100 text-purple-700",
  teal:   "bg-teal-100 text-teal-700",   slate:  "bg-slate-100 text-slate-700",
};

function Kpi({ icon: Icon, label, value, sub, tone, href }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; sub?: string; tone: string; href: string;
}) {
  return (
    <Link href={href} className="block" data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="bg-card border rounded-xl p-3.5 hover:shadow-md transition-all cursor-pointer h-full">
        <div className="flex items-center justify-between mb-2">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${TONE_BG[tone] ?? TONE_BG.slate}`}>
            <Icon className="w-4 h-4" />
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50" />
        </div>
        <div className="text-2xl font-bold tracking-tight leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">{sub}</div>}
      </div>
    </Link>
  );
}

function Card({ title, subtitle, icon: Icon, children, className = "" }: {
  title: string; subtitle?: string; icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-card border rounded-xl p-4 space-y-3 ${className}`}>
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
      <div className="bg-card border rounded-lg p-3 hover:bg-muted/30 cursor-pointer flex items-center gap-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <div className="text-sm"><span className="font-bold mr-1">{value}</span><span className="text-muted-foreground">{label}</span></div>
      </div>
    </Link>
  );
}
