import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { Tone } from "@/lib/format";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

// ---------------------------------------------------------------------------
// StatusPill — small badge with brand tones.
// ---------------------------------------------------------------------------
export function StatusPill({ label, tone = "blue" }: { label: string; tone?: Tone }) {
  const c = useColors();
  const bg =
    tone === "success" ? "rgba(22,163,74,0.12)" :
    tone === "destructive" ? "rgba(220,38,38,0.12)" :
    tone === "orange" ? "rgba(249,115,22,0.14)" :
    tone === "navy" ? "rgba(15,45,90,0.12)" :
    tone === "muted" ? c.muted :
    "rgba(30,106,176,0.12)";
  const fg =
    tone === "success" ? c.success :
    tone === "destructive" ? c.destructive :
    tone === "orange" ? c.accent :
    tone === "navy" ? c.navy :
    tone === "muted" ? c.mutedForeground :
    c.primary;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Select — modal-based picker. Value is a string; options are {value,label}.
// ---------------------------------------------------------------------------
export interface SelectOption { value: string; label: string; hint?: string }

interface SelectProps {
  label?: string;
  value: string | null | undefined;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: FeatherName;
}
export function Select({ label, value, options, onChange, placeholder, icon }: SelectProps) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[styles.inputLabel, { color: c.mutedForeground }]}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.inputWrap,
          { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        {icon ? <Feather name={icon} size={16} color={c.mutedForeground} style={{ marginRight: 8 }} /> : null}
        <Text style={[styles.inputText, { color: current ? c.foreground : c.mutedForeground }]} numberOfLines={1}>
          {current?.label ?? placeholder ?? "Select…"}
        </Text>
        <Feather name="chevron-down" size={16} color={c.mutedForeground} />
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: c.foreground }]}>{label ?? "Select"}</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {options.map(o => {
                const active = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => { onChange(o.value); setOpen(false); }}
                    style={({ pressed }) => [
                      styles.sheetItem,
                      { borderColor: c.border, opacity: pressed ? 0.85 : 1, backgroundColor: active ? c.secondary : "transparent" },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetItemTitle, { color: c.foreground }]}>{o.label}</Text>
                      {o.hint ? <Text style={[styles.sheetItemSub, { color: c.mutedForeground }]} numberOfLines={1}>{o.hint}</Text> : null}
                    </View>
                    {active ? <Feather name="check" size={16} color={c.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// DatePickerField — modal calendar for picking an ISO yyyy-mm-dd date.
// Cross-platform (web + native), no extra dependencies.
// ---------------------------------------------------------------------------
const WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad2(n: number) { return n < 10 ? `0${n}` : String(n); }
function toIso(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function parseIso(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, da = Number(m[3]);
  const d = new Date(y, mo, da);
  return Number.isNaN(d.getTime()) ? null : d;
}
function formatDisplay(s: string | null | undefined): string | null {
  const d = parseIso(s);
  if (!d) return null;
  return `${pad2(d.getDate())} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

interface DatePickerFieldProps {
  label?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: FeatherName;
}
export function DatePickerField({ label, value, onChange, placeholder, icon = "calendar" }: DatePickerFieldProps) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const selected = parseIso(value);
  const today = new Date();
  const initial = selected ?? today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const openSheet = () => {
    const base = parseIso(value) ?? new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setOpen(true);
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const goPrev = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };
  const pick = (day: number) => {
    onChange(toIso(new Date(viewYear, viewMonth, day)));
    setOpen(false);
  };
  const pickToday = () => {
    const t = new Date();
    onChange(toIso(t));
    setOpen(false);
  };
  const clear = () => { onChange(""); setOpen(false); };

  const display = formatDisplay(value);

  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[styles.inputLabel, { color: c.mutedForeground }]}>{label}</Text> : null}
      <Pressable
        onPress={openSheet}
        style={({ pressed }) => [
          styles.inputWrap,
          { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        {icon ? <Feather name={icon} size={16} color={c.mutedForeground} style={{ marginRight: 8 }} /> : null}
        <Text style={[styles.inputText, { color: display ? c.foreground : c.mutedForeground }]} numberOfLines={1}>
          {display ?? placeholder ?? "Pick a date"}
        </Text>
        {value ? (
          <Pressable
            onPress={(e) => { e.stopPropagation(); clear(); }}
            hitSlop={8}
          >
            <Feather name="x" size={16} color={c.mutedForeground} />
          </Pressable>
        ) : (
          <Feather name="chevron-down" size={16} color={c.mutedForeground} />
        )}
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.calHeader}>
              <Pressable onPress={goPrev} hitSlop={8} style={[styles.calNav, { borderColor: c.border }]}>
                <Feather name="chevron-left" size={18} color={c.foreground} />
              </Pressable>
              <Text style={[styles.sheetTitle, { color: c.foreground, marginBottom: 0, flex: 1, textAlign: "center" }]}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Text>
              <Pressable onPress={goNext} hitSlop={8} style={[styles.calNav, { borderColor: c.border }]}>
                <Feather name="chevron-right" size={18} color={c.foreground} />
              </Pressable>
            </View>
            <View style={styles.calRow}>
              {WEEK_DAYS.map((d, i) => (
                <View key={`wd-${i}`} style={styles.calCell}>
                  <Text style={[styles.calWeekday, { color: c.mutedForeground }]}>{d}</Text>
                </View>
              ))}
            </View>
            <View style={styles.calGrid}>
              {cells.map((day, i) => {
                if (day == null) return <View key={`e-${i}`} style={styles.calCell} />;
                const isSelected = !!selected
                  && selected.getFullYear() === viewYear
                  && selected.getMonth() === viewMonth
                  && selected.getDate() === day;
                const isToday = today.getFullYear() === viewYear
                  && today.getMonth() === viewMonth
                  && today.getDate() === day;
                return (
                  <Pressable
                    key={`d-${i}`}
                    onPress={() => pick(day)}
                    style={({ pressed }) => [
                      styles.calCell,
                      styles.calDay,
                      isSelected ? { backgroundColor: c.primary } : isToday ? { borderWidth: 1, borderColor: c.primary } : null,
                      pressed && !isSelected ? { backgroundColor: c.secondary } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calDayText,
                        { color: isSelected ? "#fff" : c.foreground },
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.calFooter}>
              <Pressable onPress={pickToday} style={({ pressed }) => [styles.calFooterBtn, { borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}>
                <Text style={[styles.calFooterText, { color: c.primary }]}>Today</Text>
              </Pressable>
              <Pressable onPress={clear} style={({ pressed }) => [styles.calFooterBtn, { borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}>
                <Text style={[styles.calFooterText, { color: c.mutedForeground }]}>Clear</Text>
              </Pressable>
              <Pressable onPress={() => setOpen(false)} style={({ pressed }) => [styles.calFooterBtn, { borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}>
                <Text style={[styles.calFooterText, { color: c.foreground }]}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ActionSheet — bottom sheet of named actions. Used for status/stage changes.
// ---------------------------------------------------------------------------
export interface ActionItem {
  label: string;
  icon?: FeatherName;
  destructive?: boolean;
  onPress: () => void;
}
interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  actions: ActionItem[];
}
export function ActionSheet({ visible, onClose, title, actions }: ActionSheetProps) {
  const c = useColors();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: c.card }]} onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.sheetTitle, { color: c.foreground }]}>{title}</Text>
          {actions.map(a => (
            <Pressable
              key={a.label}
              onPress={() => { a.onPress(); onClose(); }}
              style={({ pressed }) => [
                styles.sheetItem,
                { borderColor: c.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              {a.icon ? <Feather name={a.icon} size={16} color={a.destructive ? c.destructive : c.primary} /> : null}
              <Text style={[styles.sheetItemTitle, { color: a.destructive ? c.destructive : c.foreground, flex: 1 }]}>{a.label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// FormRow — inline two-up grid for compact form fields.
// ---------------------------------------------------------------------------
export function FormRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.formRow}>{children}</View>;
}
export function FormCell({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flex: 1, minWidth: "45%" }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  pill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, alignSelf: "flex-start" },
  pillText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },

  inputLabel: { fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, height: 46, borderRadius: 12, borderWidth: 1 },
  inputText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 15 },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { padding: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 8, paddingBottom: 32 },
  sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 6 },
  sheetItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  sheetItemTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  sheetItemSub: { fontFamily: "Inter_400Regular", fontSize: 12 },

  formRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  calHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  calNav: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  calRow: { flexDirection: "row" },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  calWeekday: { fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase" },
  calDay: { borderRadius: 999 },
  calDayText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  calFooter: { flexDirection: "row", gap: 8, marginTop: 8 },
  calFooterBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  calFooterText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
