import { useState } from "react";
import {
  useListRoles, useGetRolePermissions, useUpdateRolePermissions,
  getGetRolePermissionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Check, X, KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const ACTIONS = ["canView", "canCreate", "canEdit", "canApprove", "canDelete", "canExport", "canPrint"] as const;
const ACTION_LABELS: Record<typeof ACTIONS[number], string> = {
  canView: "View", canCreate: "Create", canEdit: "Edit", canApprove: "Approve",
  canDelete: "Delete", canExport: "Export", canPrint: "Print",
};

const LEVEL_BADGE: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800 border-red-200",
  company_admin: "bg-purple-100 text-purple-800 border-purple-200",
  department_admin: "bg-indigo-100 text-indigo-800 border-indigo-200",
  manager: "bg-blue-100 text-blue-800 border-blue-200",
  user: "bg-emerald-100 text-emerald-800 border-emerald-200",
  data_entry: "bg-orange-100 text-orange-800 border-orange-200",
  viewer: "bg-slate-100 text-slate-700 border-slate-200",
};

type ModulePerm = {
  module: string;
  canView: boolean; canCreate: boolean; canEdit: boolean; canApprove: boolean;
  canDelete: boolean; canExport: boolean; canPrint: boolean;
};

function PermissionMatrixDialog({
  roleId, roleName, isSuperAdmin, open, onClose,
}: { roleId: number; roleName: string; isSuperAdmin: boolean; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: perms, isLoading } = useGetRolePermissions(roleId, { query: { queryKey: getGetRolePermissionsQueryKey(roleId), enabled: open } });
  const [draft, setDraft] = useState<ModulePerm[] | null>(null);

  const update = useUpdateRolePermissions({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRolePermissionsQueryKey(roleId) });
        onClose();
      },
    },
  });

  const rows: ModulePerm[] = draft ?? (perms as ModulePerm[] | undefined) ?? [];

  const toggle = (idx: number, key: typeof ACTIONS[number]) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [key]: !r[key] } : r));
    setDraft(next);
  };
  const toggleRow = (idx: number, value: boolean) => {
    const next = rows.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r };
      for (const a of ACTIONS) updated[a] = value;
      return updated;
    });
    setDraft(next);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setDraft(null); onClose(); } }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="role-permissions-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#1e6ab0]" />
            Edit permissions — {roleName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading permissions...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Module</TableHead>
                  {ACTIONS.map(a => (
                    <TableHead key={a} className="text-center text-[11px] uppercase tracking-wider">
                      {ACTION_LABELS[a]}
                    </TableHead>
                  ))}
                  <TableHead className="text-center w-[80px] text-[11px] uppercase tracking-wider">All</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => {
                  const all = ACTIONS.every(a => row[a]);
                  return (
                    <TableRow key={row.module}>
                      <TableCell className="font-mono text-xs capitalize">
                        {row.module.replace(/_/g, " ")}
                      </TableCell>
                      {ACTIONS.map(a => (
                        <TableCell key={a} className="text-center">
                          <Checkbox
                            checked={row[a]}
                            disabled={!isSuperAdmin}
                            onCheckedChange={() => toggle(idx, a)}
                            data-testid={`perm-${row.module}-${a}`}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <Checkbox
                          checked={all}
                          disabled={!isSuperAdmin}
                          onCheckedChange={() => toggleRow(idx, !all)}
                          data-testid={`perm-${row.module}-all`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter className="border-t pt-3">
          {!isSuperAdmin && (
            <p className="text-xs text-muted-foreground mr-auto self-center">
              Only super admins can modify role permissions.
            </p>
          )}
          <Button variant="outline" onClick={() => { setDraft(null); onClose(); }}>Cancel</Button>
          <Button
            className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
            disabled={!isSuperAdmin || !draft || update.isPending}
            onClick={() => update.mutate({ id: roleId, data: { permissions: rows } })}
            data-testid="save-permissions"
          >
            {update.isPending ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RolesAdmin() {
  const { user } = useAuth();
  const isSuperAdmin = (user as { permissionLevel?: string } | undefined)?.permissionLevel === "super_admin";
  const { data: roles, isLoading } = useListRoles();
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-[#1e6ab0]" />
          Roles & Permissions
        </h1>
        <p className="text-muted-foreground text-sm">
          7 system roles map to a permission matrix across all modules. Per-user overrides are managed
          from the Users page.
        </p>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-center">Level</TableHead>
              <TableHead className="text-center">Modules</TableHead>
              <TableHead className="text-center">Users</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : !roles || roles.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No roles defined.</TableCell></TableRow>
            ) : roles.map(r => (
              <TableRow key={r.id} data-testid={`role-row-${r.code}`}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`${LEVEL_BADGE[r.code] ?? ""} text-[10px]`}>
                      {r.name}
                    </Badge>
                    {r.isSystem && <span className="text-[10px] text-muted-foreground uppercase tracking-wider">system</span>}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.code}</TableCell>
                <TableCell className="text-center font-mono text-sm">{r.permissionLevel}</TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Check className="w-3 h-3 text-emerald-600" /> {r.permissionCount}
                  </span>
                </TableCell>
                <TableCell className="text-center text-sm">{r.userCount}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">{r.description ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing({ id: r.id, name: r.name })}
                    data-testid={`edit-role-${r.code}`}
                  >
                    <Shield className="w-3.5 h-3.5 mr-1.5" />
                    {isSuperAdmin ? "Edit" : "View"} Permissions
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <PermissionMatrixDialog
          open={!!editing}
          roleId={editing.id}
          roleName={editing.name}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
