import React from "react";

/**
 * Ultra-premium letterhead-style header for Accounts pages.
 * Navy top rule + gold hairline accent + Playfair display title.
 */
export function AccountsPageHeader({
  title,
  subtitle,
  breadcrumb,
  right,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="relative mb-5">
      {/* navy top rule */}
      <div className="h-[2px] w-full bg-[#0f2d5a]" />
      {/* gold hairline accent */}
      <div className="h-[1px] w-24 bg-[#c9a14a] mt-[1px]" />

      <div className="flex items-end justify-between gap-4 pt-3 pb-3">
        <div className="min-w-0">
          {breadcrumb && (
            <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-medium mb-1">
              {breadcrumb}
            </div>
          )}
          <h1
            className="text-[24px] sm:text-[28px] font-extrabold text-[#0f2d5a] leading-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.01em" }}
          >
            {title}
          </h1>
          {subtitle && (
            <div className="text-[12px] text-gray-500 mt-1 font-light italic">{subtitle}</div>
          )}
        </div>
        {right && (
          <div className="flex items-center gap-1.5 flex-shrink-0 bg-white border border-gray-200 rounded-full px-1.5 py-1 shadow-sm">
            {right}
          </div>
        )}
      </div>
    </div>
  );
}

/** Hairline glass stat — used inside <AccountsStatStrip>, no boxes, just numerals + label. */
export function AccountsStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  const toneCls =
    tone === "good" ? "text-emerald-700"
      : tone === "bad" ? "text-rose-700"
      : tone === "warn" ? "text-amber-700"
      : "text-[#0f2d5a]";
  return (
    <div className="flex-1 min-w-0 px-5 py-3 first:pl-0">
      <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500 font-medium">{label}</div>
      <div
        className={`text-[22px] font-bold mt-0.5 tabular-nums ${toneCls}`}
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {value}
      </div>
    </div>
  );
}

/** Glass strip wrapping multiple <AccountsStat /> with hairline dividers. */
export function AccountsStatStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-stretch gap-0 bg-white/60 backdrop-blur border border-gray-200/80 rounded-xl divide-x divide-gray-200 overflow-hidden mb-4">
      {children}
    </div>
  );
}

/** Status dot + label, replacing colored badge pills. */
export function StatusDot({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "good" | "bad" | "warn" | "info" | "default";
}) {
  const dot =
    tone === "good" ? "bg-emerald-500"
      : tone === "bad" ? "bg-rose-500"
      : tone === "warn" ? "bg-amber-500"
      : tone === "info" ? "bg-sky-500"
      : "bg-gray-400";
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-700 capitalize">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

/** Soft filter strip — borderless inputs grouped on a #fafafa surface. */
export function AccountsFilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 bg-[#fafafa] border border-gray-200/80 rounded-xl px-4 py-3 mb-4">
      {children}
    </div>
  );
}

/** Skeleton row for tables while loading. */
export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-gray-100">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="px-4 py-3">
              <div className="h-3 rounded bg-gray-100 animate-pulse" style={{ width: `${40 + ((r + c) % 5) * 12}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
