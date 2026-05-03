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
});
