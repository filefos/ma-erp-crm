import React from "react";
import { useRouter } from "expo-router";
import { DashboardScreen } from "@/components/Dashboard";
import { QuickLink, SectionHeading } from "@/components/ui";

export default function ProjectsTab() {
  const router = useRouter();
  return (
    <DashboardScreen title="Projects" subtitle="Active projects, stage progress and sales performance">
      <SectionHeading title="Quick access" />
      <QuickLink icon="bar-chart-2" label="Projects Dashboard" hint="Stage breakdown, value, overdue" onPress={() => router.push("/projects/dashboard")} />
      <QuickLink icon="folder" label="All projects" hint="Search, filter, edit project details" onPress={() => router.push("/projects/list")} />
      <QuickLink icon="target" label="Sales Performance" hint="Targets vs achieved by salesperson" onPress={() => router.push("/projects/sales-performance")} />

      <SectionHeading title="Shortcuts" />
      <QuickLink icon="plus" label="New project" onPress={() => router.push("/projects/new")} />
    </DashboardScreen>
  );
}
