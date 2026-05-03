import React from "react";
import { useRouter } from "expo-router";
import { DashboardScreen } from "@/components/Dashboard";
import { QuickLink, SectionHeading } from "@/components/ui";
import { useApp } from "@/contexts/AppContext";
import { canManageHr } from "@/lib/permissions";

export default function HrTab() {
  const router = useRouter();
  const { user } = useApp();
  const canManage = canManageHr(user);
  return (
    <DashboardScreen title="HR" subtitle="Employees, attendance and team performance">
      <SectionHeading title="Quick access" />
      <QuickLink icon="bar-chart-2" label="HR Dashboard" hint="Workforce KPIs and demographics" onPress={() => router.push("/hr/dashboard")} />
      <QuickLink icon="users" label="Employees" hint="Browse and manage staff & labour" onPress={() => router.push("/hr/employees")} />
      <QuickLink icon="check-square" label="Attendance" hint="Today's status, mark presence, history" onPress={() => router.push("/hr/attendance")} />

      {canManage ? (
        <>
          <SectionHeading title="Shortcuts" />
          <QuickLink icon="user-plus" label="Add new employee" onPress={() => router.push("/hr/employees/new")} />
        </>
      ) : null}
    </DashboardScreen>
  );
}
