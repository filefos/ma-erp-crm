import React from "react";
import { useApp } from "@/contexts/AppContext";
import { homeFor, visibleModulesFor } from "@/lib/permissions";
import { UserBoot } from "@/components/UserBoot";
import {
  AccountantDashboard,
  AdminDashboard,
  AssetsDashboard,
  AttendanceDashboard,
  BootingDashboard,
  CrmDashboard,
  InventoryDashboard,
  NoAccessDashboard,
  ProcurementDashboard,
  SalespersonDashboard,
} from "@/components/dashboards";

export default function HomeRouter() {
  const { user } = useApp();

  if (!user) {
    return (
      <>
        <UserBoot />
        <BootingDashboard />
      </>
    );
  }

  const visible = visibleModulesFor(user as never);
  if (visible.length === 0) return <NoAccessDashboard />;

  switch (homeFor(user as never)) {
    case "accountant":   return <AccountantDashboard />;
    case "salesperson":  return <SalespersonDashboard />;
    case "attendance":   return <AttendanceDashboard />;
    case "procurement":  return <ProcurementDashboard />;
    case "inventory":    return <InventoryDashboard />;
    case "assets":       return <AssetsDashboard />;
    case "admin":        return <AdminDashboard />;
    case "crm":
    default:             return <CrmDashboard />;
  }
}
