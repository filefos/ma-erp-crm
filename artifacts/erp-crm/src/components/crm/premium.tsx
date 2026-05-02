import { Link } from "wouter";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

const TONES = {
  navy:   { bg: "from-[#0f2d5a] to-[#1e6ab0]",        icon: "bg-white/15 text-white",                              spark: "#1e6ab0" },
  blue:   { bg: "from-blue-500/10 to-blue-500/0",     icon: "bg-blue-500/15 text-blue-700 dark:text-blue-300",     spark: "#1e6ab0" },
  red:    { bg: "from-red-500/10 to-red-500/0",       icon: "bg-red-500/15 text-red-600",                          spark: "#ef4444" },
  amber:  { bg: "from-amber-500/10 to-amber-500/0",   icon: "bg-amber-500/15 text-amber-600",                      spark: "#f59e0b" },
  green:  { bg: "from-emerald-500/10 to-emerald-500/0", icon: "bg-emerald-500/15 text-emerald-600",                spark: "#10b981" },
  purple: { bg: "from-purple-500/10 to-purple-500/0", icon: "bg-purple-500/15 text-purple-600",                    spark: "#8b5cf6" },
  indigo: { bg: "from-indigo-500/10 to-indigo-500/0", icon: "bg-indigo-500/15 text-indigo-600",                    spark: "#6366f1" },
  teal:   { bg: "from-teal-500/10 to-teal-500/0",     icon: "bg-teal-500/15 text-teal-600",                        spark: "#14b8a6" },
  slate:  { bg: "from-slate-500/10 to-slate-500/0",   icon: "bg-slate-500/15 text-slate-600",                      spark: "#64748b" },
} as const;

export type Tone = keyof typeof TONES;

export function Sparkline({
  data, color = "#1e6ab0", height = 28, width = 80,
}: { data: number[]; color?: string; height?: number; width?: number }) {
  if (!data || data.length < 2) return <div style={{ height, width }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${height - ((v - min) / span) * height}`);
  const d = "M " + pts.join(" L ");
  const fillPath = `${d} L ${width},${height} L 0,${height} Z`;
  const lastY = height - ((data[data.length - 1] - min) / span) * height;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible shrink-0">
      <path d={fillPath} fill={color} fillOpacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(data.length - 1) * step} cy={lastY} r={2.2} fill={color} />
    </svg>
  );
}

export function PremiumCard({
  children, className = "", tone = "blue",
}: { children: ReactNode; className?: string; tone?: Tone }) {
  const t = TONES[tone] ?? TONES.blue;
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br ${t.bg} backdrop-blur-sm shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function KPIWidget({
  icon: Icon, label, value, sub, tone = "blue", trend, sparkline, href, testId,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: Tone;
  trend?: number;
  sparkline?: number[];
  href?: string;
  testId?: string;
}) {
  const t = TONES[tone] ?? TONES.blue;
  const trendIcon = trend === undefined
    ? null
    : trend > 0 ? <ArrowUpRight className="w-3 h-3" />
    : trend < 0 ? <ArrowDownRight className="w-3 h-3" />
    : <Minus className="w-3 h-3" />;
  const trendColor = trend === undefined
    ? ""
    : trend > 0 ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400"
    : trend < 0 ? "text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-400"
    : "text-muted-foreground bg-muted";

  const inner = (
    <div className="group relative h-full rounded-2xl border border-border/60 bg-card hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${t.bg} opacity-70`} />
      <div className="pointer-events-none absolute -right-8 -top-8 w-24 h-24 rounded-full opacity-30 blur-2xl" style={{ background: t.spark }} />
      <div className="relative p-4">
        <div className="flex items-start justify-between gap-2">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.icon} ring-1 ring-black/5 shadow-sm`}>
            <Icon className="w-4 h-4" />
          </div>
          {trend !== undefined && (
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${trendColor}`}>
              {trendIcon}{Math.min(Math.abs(trend), 999)}%
            </span>
          )}
        </div>
        <div className="mt-3 text-2xl font-bold tracking-tight leading-none">{value}</div>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-foreground/85 truncate">{label}</div>
            {sub && <div className="text-[10px] text-muted-foreground/80 truncate">{sub}</div>}
          </div>
          {sparkline && sparkline.length >= 2 && (
            <Sparkline data={sparkline} color={t.spark} />
          )}
        </div>
      </div>
    </div>
  );

  if (href) return <Link href={href} className="block h-full" data-testid={testId}>{inner}</Link>;
  return <div data-testid={testId} className="h-full">{inner}</div>;
}

const STATUS_STYLES: Record<string, string> = {
  new:                "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/40",
  contacted:          "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-900/40",
  qualified:          "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/40",
  qualification:      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/40",
  site_visit:         "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-900/40",
  quotation_required: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40",
  quotation_sent:     "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-900/40",
  proposal:           "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40",
  negotiation:        "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-900/40",
  won:                "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40",
  lost:               "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/40",
};

export function StatusBadge({ status, className = "" }: { status?: string; className?: string }) {
  const s = (status ?? "new").toLowerCase();
  const style = STATUS_STYLES[s] ?? "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize ${style} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {s.replace(/_/g, " ")}
    </span>
  );
}

export function PriorityBadge({
  priority, className = "",
}: { priority?: "high" | "medium" | "low" | string; className?: string }) {
  const p = (priority ?? "medium").toLowerCase();
  const styles: Record<string, { bg: string; label: string; dot: string }> = {
    high:   { bg: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/40",       label: "High",   dot: "bg-red-500" },
    medium: { bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40", label: "Medium", dot: "bg-amber-500" },
    low:    { bg: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700", label: "Low",    dot: "bg-slate-400" },
  };
  const s = styles[p] ?? styles.medium;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${s.bg} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function AIScoreBadge({ score, className = "" }: { score?: string; className?: string }) {
  const s = (score ?? "warm").toLowerCase();
  const styles: Record<string, string> = {
    hot:  "bg-gradient-to-r from-red-500 to-orange-500 text-white",
    warm: "bg-gradient-to-r from-amber-400 to-yellow-500 text-white",
    cold: "bg-gradient-to-r from-sky-400 to-blue-500 text-white",
  };
  const emoji: Record<string, string> = { hot: "🔥", warm: "🌡️", cold: "❄️" };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${styles[s] ?? styles.warm} ${className}`}>
      <span>{emoji[s] ?? "•"}</span>{s.toUpperCase()}
    </span>
  );
}

export function Avatar({
  name, size = 28, className = "",
}: { name?: string | null; size?: number; className?: string }) {
  const initials =
    (name ?? "?").trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "?";
  let hash = 0;
  for (const c of (name ?? "")) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white shadow-sm shrink-0 ring-1 ring-black/5 ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: `linear-gradient(135deg, hsl(${hue} 65% 45%), hsl(${(hue + 30) % 360} 65% 35%))`,
      }}
      title={name ?? undefined}
    >
      {initials}
    </div>
  );
}

export function ExecutiveHeader({
  title, subtitle, icon: Icon, children,
}: {
  title: string;
  subtitle?: string;
  icon?: ComponentType<{ className?: string }>;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f2d5a] via-[#163d76] to-[#1e6ab0] p-5 md:p-6 text-white shadow-lg">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{ background: "radial-gradient(circle at 90% -20%, rgba(255,255,255,0.30), transparent 60%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.25) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="w-11 h-11 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center backdrop-blur-sm shrink-0">
              <Icon className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight leading-tight">{title}</h1>
            {subtitle && <p className="text-xs md:text-sm text-white/75 mt-1">{subtitle}</p>}
          </div>
        </div>
        {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
      </div>
    </div>
  );
}

// --- Helpers used across pages -------------------------------------------------

export function weeklyCounts(items: any[], dateKey: string, weeks = 8): number[] {
  const now = Date.now();
  const buckets = new Array(weeks).fill(0);
  for (const it of items) {
    const v = it?.[dateKey];
    if (!v) continue;
    const t = new Date(v).getTime();
    if (!isFinite(t)) continue;
    const idx = weeks - 1 - Math.floor((now - t) / (7 * 86_400_000));
    if (idx >= 0 && idx < weeks) buckets[idx]++;
  }
  return buckets;
}

export function weeklyValues(
  items: any[], dateKey: string, valueFn: (i: any) => number, weeks = 8,
): number[] {
  const now = Date.now();
  const buckets = new Array(weeks).fill(0);
  for (const it of items) {
    const v = it?.[dateKey];
    if (!v) continue;
    const t = new Date(v).getTime();
    if (!isFinite(t)) continue;
    const idx = weeks - 1 - Math.floor((now - t) / (7 * 86_400_000));
    if (idx >= 0 && idx < weeks) buckets[idx] += valueFn(it) || 0;
  }
  return buckets;
}

export function trendPct(series: number[]): number | undefined {
  if (!series || series.length < 2) return undefined;
  const half = Math.floor(series.length / 2);
  const prev = series.slice(0, half).reduce((s, v) => s + v, 0);
  const curr = series.slice(half).reduce((s, v) => s + v, 0);
  if (prev === 0 && curr === 0) return undefined;
  if (prev === 0) return 100;
  return Math.round(((curr - prev) / prev) * 100);
}
