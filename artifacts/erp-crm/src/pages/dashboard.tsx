import { useAuth } from "@/hooks/useAuth";
import { AdminDashboard } from "@/pages/admin-dashboard";
import { DepartmentDashboard } from "@/pages/department-dashboard";

const ADMIN_LEVELS = new Set(["super_admin", "company_admin"]);

export function Dashboard() {
  const { user } = useAuth();
  const level = (user as { permissionLevel?: string } | undefined)?.permissionLevel ?? "user";

  if (ADMIN_LEVELS.has(level)) return <AdminDashboard />;
  return <DepartmentDashboard />;
}
