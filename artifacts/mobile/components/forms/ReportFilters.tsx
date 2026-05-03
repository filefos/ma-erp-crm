import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Select } from "@/components/forms";
import { useApp } from "@/contexts/AppContext";

export type ReportRange = "30d" | "90d" | "12mo" | "ytd" | "all";

const RANGE_OPTIONS: { value: ReportRange; label: string }[] = [
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "12mo", label: "12mo" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All" },
];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function rangeBounds(range: ReportRange): { from: string | null; to: string } {
  const now = new Date();
  const to = ymd(now);
  if (range === "all") return { from: null, to };
  const from = new Date(now);
  if (range === "30d") from.setDate(now.getDate() - 30);
  else if (range === "90d") from.setDate(now.getDate() - 90);
  else if (range === "12mo") from.setMonth(now.getMonth() - 12);
  else if (range === "ytd") {
    from.setMonth(0);
    from.setDate(1);
  }
  return { from: ymd(from), to };
}

export function inRange(date: string | null | undefined, from: string | null, to: string): boolean {
  if (!date) return from === null;
  const key = date.length >= 10 ? date.slice(0, 10) : date;
  if (from && key < from) return false;
  if (key > to) return false;
  return true;
}

export interface ReportFiltersState {
  range: ReportRange;
  from: string | null;
  to: string;
  companyId: number | null;
}

export function useReportFilters(initial: ReportRange = "12mo"): {
  state: ReportFiltersState;
  filters: React.ReactNode;
} {
  const { user, activeCompanyId, setActiveCompany } = useApp();
  const [range, setRange] = useState<ReportRange>(initial);
  const accessible = user?.accessibleCompanies ?? [];
  const companyOptions = useMemo(() => {
    if (accessible.length <= 1) return [] as { value: string; label: string }[];
    return accessible.map(co => ({ value: String(co.id), label: co.name ?? `Company ${co.id}` }));
  }, [accessible]);

  const { from, to } = useMemo(() => rangeBounds(range), [range]);

  const filters = (
    <ReportFiltersBar
      range={range}
      onRangeChange={setRange}
      companyOptions={companyOptions}
      activeCompanyId={activeCompanyId}
      onCompanyChange={(id) => { void setActiveCompany(id); }}
    />
  );

  return {
    state: { range, from, to, companyId: activeCompanyId },
    filters,
  };
}

function ReportFiltersBar({
  range,
  onRangeChange,
  companyOptions,
  activeCompanyId,
  onCompanyChange,
}: {
  range: ReportRange;
  onRangeChange: (r: ReportRange) => void;
  companyOptions: { value: string; label: string }[];
  activeCompanyId: number | null;
  onCompanyChange: (id: number) => void;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 10, marginBottom: 4 }}>
      {companyOptions.length > 0 ? (
        <Select
          label="Company"
          icon="briefcase"
          value={activeCompanyId != null ? String(activeCompanyId) : ""}
          options={companyOptions}
          onChange={(v) => { if (v) onCompanyChange(Number(v)); }}
        />
      ) : null}
      <View>
        <Text style={[styles.label, { color: c.mutedForeground }]}>Date range</Text>
        <View style={styles.row}>
          {RANGE_OPTIONS.map(opt => {
            const active = opt.value === range;
            return (
              <Pressable
                key={opt.value}
                onPress={() => onRangeChange(opt.value)}
                style={[
                  styles.chip,
                  { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary : c.card },
                ]}
              >
                <Text style={{ color: active ? "#fff" : c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: "Inter_600SemiBold", fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
});
