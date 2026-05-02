import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useGetUserPermissions, getGetUserPermissionsQueryKey } from "@workspace/api-client-react";

type Action = "canView" | "canCreate" | "canEdit" | "canApprove" | "canDelete" | "canExport" | "canPrint";

interface PermissionRow {
  module: string;
  roleDefault: Record<Action, boolean>;
  override: Record<Action, boolean | null> | null;
}

/**
 * Frontend route guard that gates non-admin module routes by the user's
 * effective permissions. Calls the same endpoint that backs the admin matrix
 * (it allows self-access). super_admin bypasses without a network call.
 *
 * On unauthorized access, redirects to /dashboard.
 */
export function ModuleGuard({ module, action = "canView", children }: { module: string; action?: Action; children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const userId = user?.id;
  const isSuperAdmin = user?.permissionLevel === "super_admin";

  const { data, isLoading: permsLoading } = useGetUserPermissions(userId ?? 0, {
    query: {
      queryKey: getGetUserPermissionsQueryKey(userId ?? 0),
      enabled: !!userId && !isSuperAdmin,
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  });

  const rows = (data ?? []) as PermissionRow[];
  const row = rows.find((r) => r.module === module);
  // Effective permission = override (if non-null) else roleDefault
  let allowed = isSuperAdmin;
  if (!isSuperAdmin && row) {
    const ovr = row.override?.[action];
    const def = row.roleDefault?.[action];
    allowed = ovr === true ? true : ovr === false ? false : !!def;
  }

  useEffect(() => {
    if (!authLoading && user && !permsLoading && !isSuperAdmin && !allowed) {
      setLocation("/dashboard");
    }
  }, [authLoading, user, permsLoading, isSuperAdmin, allowed, setLocation]);

  if (authLoading || !user || (!isSuperAdmin && permsLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!allowed) return null;
  return <>{children}</>;
}
