import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

// ---------------------------------------------------------------------------
// Brand button — primary navy/blue, secondary outline, ghost.
// ---------------------------------------------------------------------------
interface BrandButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "accent";
  loading?: boolean;
  disabled?: boolean;
  icon?: FeatherName;
  testID?: string;
  style?: ViewStyle;
}
export function BrandButton({ label, onPress, variant = "primary", loading, disabled, icon, testID, style }: BrandButtonProps) {
  const c = useColors();
  const isDisabled = !!disabled || !!loading;
  const bg =
    variant === "primary" ? c.primary :
    variant === "accent" ? c.accent :
    variant === "secondary" ? c.card : "transparent";
  const fg =
    variant === "primary" || variant === "accent" ? "#ffffff" :
    variant === "secondary" ? c.foreground : c.primary;
  const border =
    variant === "secondary" ? c.border : "transparent";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border, opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={fg} />
        : (
          <View style={styles.row}>
            {icon ? <Feather name={icon} size={16} color={fg} /> : null}
            <Text style={[styles.btnLabel, { color: fg }]}>{label}</Text>
          </View>
        )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Branded text input — used on login + future form screens.
// ---------------------------------------------------------------------------
interface BrandInputProps extends TextInputProps {
  label?: string;
  icon?: FeatherName;
  error?: string;
}
export function BrandInput({ label, icon, error, style, ...rest }: BrandInputProps) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[styles.inputLabel, { color: c.mutedForeground }]}>{label}</Text> : null}
      <View style={[styles.inputWrap, { backgroundColor: c.card, borderColor: error ? c.destructive : c.border }]}>
        {icon ? <Feather name={icon} size={16} color={c.mutedForeground} style={{ marginRight: 8 }} /> : null}
        <TextInput
          {...rest}
          style={[styles.input, { color: c.foreground }, style]}
          placeholderTextColor={c.mutedForeground}
        />
      </View>
      {error ? <Text style={[styles.errorText, { color: c.destructive }]}>{error}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// KPI tile + grid container.
// ---------------------------------------------------------------------------
interface KpiTileProps {
  label: string;
  value: string | number;
  icon?: FeatherName;
  tone?: "navy" | "blue" | "orange" | "muted";
  hint?: string;
}
export function KpiTile({ label, value, icon, tone = "blue", hint }: KpiTileProps) {
  const c = useColors();
  const accentBg =
    tone === "navy" ? c.navy :
    tone === "orange" ? c.accent :
    tone === "muted" ? c.muted :
    c.primary;
  const accentFg = tone === "muted" ? c.foreground : "#ffffff";
  return (
    <View style={[styles.kpi, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={[styles.kpiIcon, { backgroundColor: accentBg }]}>
        {icon ? <Feather name={icon} size={16} color={accentFg} /> : null}
      </View>
      <Text style={[styles.kpiValue, { color: c.foreground }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: c.mutedForeground }]} numberOfLines={2}>{label}</Text>
      {hint ? <Text style={[styles.kpiHint, { color: c.mutedForeground }]} numberOfLines={1}>{hint}</Text> : null}
    </View>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.kpiGrid}>{children}</View>;
}

// ---------------------------------------------------------------------------
// Quick-link row used in dashboards.
// ---------------------------------------------------------------------------
interface QuickLinkProps {
  label: string;
  icon: FeatherName;
  hint?: string;
  onPress: () => void;
}
export function QuickLink({ label, icon, hint, onPress }: QuickLinkProps) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickLink,
        { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: c.secondary }]}>
        <Feather name={icon} size={16} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.quickLabel, { color: c.foreground }]}>{label}</Text>
        {hint ? <Text style={[styles.quickHint, { color: c.mutedForeground }]} numberOfLines={1}>{hint}</Text> : null}
      </View>
      <Feather name="chevron-right" size={16} color={c.mutedForeground} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Section heading used on every dashboard.
// ---------------------------------------------------------------------------
export function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: c.foreground }]}>{title}</Text>
      {action}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Card container.
// ---------------------------------------------------------------------------
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty / loading / error states.
// ---------------------------------------------------------------------------
export function EmptyState({ icon, title, hint }: { icon: FeatherName; title: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <Feather name={icon} size={26} color={c.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: c.foreground }]}>{title}</Text>
      {hint ? <Text style={[styles.emptyHint, { color: c.mutedForeground }]}>{hint}</Text> : null}
    </View>
  );
}

export function LoadingBlock({ label }: { label?: string }) {
  const c = useColors();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={c.primary} />
      {label ? <Text style={[styles.loadingLabel, { color: c.mutedForeground }]}>{label}</Text> : null}
    </View>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <Feather name="alert-triangle" size={26} color={c.destructive} />
      <Text style={[styles.emptyTitle, { color: c.foreground }]}>Couldn't load data</Text>
      <Text style={[styles.emptyHint, { color: c.mutedForeground }]} numberOfLines={3}>{message}</Text>
      {onRetry ? <BrandButton label="Try again" onPress={onRetry} variant="secondary" icon="refresh-cw" /> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Skeleton block — used for shimmer-y placeholders.
// ---------------------------------------------------------------------------
export function Skeleton({ height = 16, width, style }: { height?: number; width?: number | string; style?: ViewStyle }) {
  const c = useColors();
  return (
    <View
      style={[
        { height, width: width as number | undefined, backgroundColor: c.muted, borderRadius: 6 },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },

  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  btnLabel: { fontFamily: "Inter_600SemiBold", fontSize: 15 },

  inputLabel: { fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, height: 46,
    borderRadius: 12, borderWidth: 1,
  },
  input: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15 } as TextStyle,
  errorText: { fontFamily: "Inter_500Medium", fontSize: 12 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: {
    flexBasis: "48%", flexGrow: 1,
    padding: 14, borderRadius: 14, borderWidth: 1,
    gap: 6,
  },
  kpiIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  kpiValue: { fontFamily: "Inter_700Bold", fontSize: 22 },
  kpiLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  kpiHint: { fontFamily: "Inter_400Regular", fontSize: 11 },

  quickLink: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  quickIcon: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  quickLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  quickHint: { fontFamily: "Inter_400Regular", fontSize: 12 },

  sectionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 8, marginBottom: 4,
  },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },

  card: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },

  empty: { padding: 24, alignItems: "center", gap: 6 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  emptyHint: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" },

  loading: { padding: 24, alignItems: "center", gap: 8 },
  loadingLabel: { fontFamily: "Inter_500Medium", fontSize: 13 },
});
