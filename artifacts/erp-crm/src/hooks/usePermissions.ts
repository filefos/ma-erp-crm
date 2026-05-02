import { useAuth } from "@/hooks/useAuth";
import { useGetUserPermissions, getGetUserPermissionsQueryKey } from "@workspace/api-client-react";

type Action = "canView" | "canCreate" | "canEdit" | "canApprove" | "canDelete" | "canExport" | "canPrint";

interface PermissionRow {
  module: string;
  roleDefault: Record<Action, boolean>;
  override: Record<Action, boolean | null> | null;
}

/**
 * Effective module-permission helper. Mirrors the rule used by the server
 * matrix and ModuleGuard: super_admin bypasses; otherwise effective =
 * override (if non-null) else roleDefault.
 *
 * Returns `can(module, action?)` — defaults to "canView". Returns false until
 * permissions have loaded (fail-closed) so dashboards don't render or fetch
 * data the user cannot see.
 */
export function usePermissions() {
  const { user, isLoading: authLoading } = useAuth();
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
  const ready = !authLoading && !!user && (isSuperAdmin || !permsLoading);

  function can(module: string, action: Action = "canView"): boolean {
    if (!ready) return false;
    if (isSuperAdmin) return true;
    const row = rows.find((r) => r.module === module);
    if (!row) return false;
    const ovr = row.override?.[action];
    if (ovr === true) return true;
    if (ovr === false) return false;
    return !!row.roleDefault?.[action];
  }

  return { can, ready, isSuperAdmin };
}
