import React from "react";

/**
 * Reference-letterhead-style page header for all Accounts pages.
 * Bold uppercase navy title with thin underline, optional subtitle and right-side actions.
 */
export function AccountsPageHeader({
  title,
  subtitle,
  right,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 pb-2 border-b-2 border-[#0f2d5a]">
      <div className="min-w-0">
        <h1 className="text-[18px] sm:text-[20px] font-black uppercase tracking-wide text-[#0f2d5a] leading-tight">
          {title}
        </h1>
        {subtitle && (
          <div className="text-[11px] italic text-gray-600 mt-0.5">{subtitle}</div>
        )}
      </div>
      {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
    </div>
  );
}

/** Compact stat row matching the clean print look — no gradients, thin border. */
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
    tone === "good" ? "text-green-700"
      : tone === "bad" ? "text-red-700"
      : tone === "warn" ? "text-orange-700"
      : "text-[#0f2d5a]";
  return (
    <div className="border border-gray-300 rounded px-3 py-2 bg-white">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${toneCls}`}>{value}</div>
    </div>
  );
}
