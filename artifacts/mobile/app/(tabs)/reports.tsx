import React from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { DashboardScreen } from "@/components/Dashboard";
import { SectionHeading } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

interface ReportCardProps {
  title: string;
  description: string;
  icon: FeatherName;
  tone: "navy" | "blue" | "orange" | "success";
  onPress: () => void;
}

function ReportCard({ title, description, icon, tone, onPress }: ReportCardProps) {
  const c = useColors();
  const bg =
    tone === "navy" ? c.navy :
    tone === "orange" ? c.accent :
    tone === "success" ? c.success :
    c.primary;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, flexBasis: "48%", flexGrow: 1 }]}>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={[styles.icon, { backgroundColor: bg }]}>
          <Feather name={icon} size={18} color="#ffffff" />
        </View>
        <Text style={[styles.title, { color: c.foreground }]}>{title}</Text>
        <Text style={[styles.desc, { color: c.mutedForeground }]} numberOfLines={2}>{description}</Text>
      </View>
    </Pressable>
  );
}

const REPORTS: { route: string; title: string; description: string; icon: FeatherName; tone: "navy" | "blue" | "orange" | "success" }[] = [
  { route: "/reports/revenue",            title: "Revenue",            description: "Invoiced revenue and collections",      icon: "trending-up",   tone: "success" },
  { route: "/reports/expenses",           title: "Expenses",           description: "Spend by category and status",          icon: "credit-card",   tone: "orange" },
  { route: "/reports/profit-margin",      title: "Profit margin",      description: "Revenue vs expenses, monthly P&L",      icon: "pie-chart",     tone: "navy" },
  { route: "/reports/sales-pipeline",     title: "Sales pipeline",     description: "Lead funnel and conversion",            icon: "filter",        tone: "blue" },
  { route: "/reports/attendance",         title: "Attendance",         description: "Workforce attendance & overtime",       icon: "user-check",    tone: "blue" },
  { route: "/reports/procurement",        title: "Procurement spend",  description: "POs and supplier breakdown",            icon: "shopping-cart", tone: "orange" },
  { route: "/reports/project-completion", title: "Project completion", description: "Stage progress and completion rate",    icon: "check-circle",  tone: "success" },
];

export default function ReportsTab() {
  const router = useRouter();
  return (
    <DashboardScreen title="Reports" subtitle="Phone-friendly snapshots across the business">
      <SectionHeading title="All reports" />
      <View style={styles.grid}>
        {REPORTS.map(r => (
          <ReportCard
            key={r.route}
            title={r.title}
            description={r.description}
            icon={r.icon}
            tone={r.tone}
            onPress={() => router.push(r.route as never)}
          />
        ))}
      </View>
    </DashboardScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 8, minHeight: 130 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  desc: { fontFamily: "Inter_500Medium", fontSize: 12, lineHeight: 16 },
});
