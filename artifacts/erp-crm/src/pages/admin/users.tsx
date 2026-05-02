import { useEffect, useMemo, useState } from "react";
import {
  useListUsers, useCreateUser, useUpdateUser, useListCompanies, useListDepartments,
  useGetUserPermissions, useUpdateUserPermissions,
  getListUsersQueryKey, getGetUserPermissionsQueryKey,
} from "@workspace/api-client-react";
import type { UserModulePermission } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Power, Pencil, ShieldCheck, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

const PERMISSION_LEVELS = [
  { value: "super_admin", label: "Super Admin", color: "bg-red-100 text-red-800" },
  { value: "company_admin", label: "Company Admin", color: "bg-purple-100 text-purple-800" },
  { value: "department_admin", label: "Department Admin", color: "bg-indigo-100 text-indigo-800" },
  { value: "manager", label: "Manager", color: "bg-blue-100 text-blue-800" },
  { value: "user", label: "User", color: "bg-emerald-100 text-emerald-800" },
  { value: "data_entry", label: "Data Entry", color: "bg-amber-100 text-amber-800" },
  { value: "viewer", label: "Viewer", color: "bg-slate-100 text-slate-800" },
];

const ROLES = ["sales","accounts","finance","procurement","store","hr","production","management","admin","user"];

const ACTIONS = ["canView","canCreate","canEdit","canApprove","canDelete","canExport","canPrint"] as const;
type Action = typeof ACTIONS[number];
const ACTION_LABELS: Record<Action, string> = {
  canView: "View", canCreate: "Create", canEdit: "Edit", canApprove: "Approve",
  canDelete: "Delete", canExport: "Export", canPrint: "Print",
};

type EditableUser = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
  permissionLevel?: string;
  departmentId?: number | null;
  companyId?: number | null;
};

function EditUserDialog({
  user, open, onClose, departments, companies,
}: {
  user: EditableUser;
  open: boolean;
  onClose: () => void;
  departments: { id: number; name: string }[];
  companies: { id: number; shortName: string }[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    role: user.role,
    permissionLevel: user.permissionLevel ?? "user",
    departmentId: user.departmentId ? String(user.departmentId) : "none",
    companyId: user.companyId ? String(user.companyId) : "none",
  });
  useEffect(() => {
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      role: user.role,
      permissionLevel: user.permissionLevel ?? "user",
      departmentId: user.departmentId ? String(user.departmentId) : "none",
      companyId: user.companyId ? String(user.companyId) : "none",
    });
  }, [user]);

  const update = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        onClose();
      },
    },
  });

  const submit = () => {
    update.mutate({
      id: user.id,
      data: {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        role: form.role,
        permissionLevel: form.permissionLevel,
        departmentId: form.departmentId !== "none" ? parseInt(form.departmentId, 10) : undefined,
        companyId: form.companyId !== "none" ? parseInt(form.companyId, 10) : undefined,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent data-testid="edit-user-dialog">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-[#1e6ab0]" />Edit user — {user.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="space-y-1 col-span-2"><Label>Full Name *</Label><Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} data-testid="edit-user-name" /></div>
          <div className="space-y-1"><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} /></div>
          <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} /></div>
          <div className="space-y-1"><Label>Department Code</Label>
            <Select value={form.role} onValueChange={v => setForm(p => ({...p, role: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r.replace("_"," ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Permission Level</Label>
            <Select value={form.permissionLevel} onValueChange={v => setForm(p => ({...p, permissionLevel: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PERMISSION_LEVELS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Department</Label>
            <Select value={form.departmentId} onValueChange={v => setForm(p => ({...p, departmentId: v}))}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Primary Company</Label>
            <Select value={form.companyId} onValueChange={v => setForm(p => ({...p, companyId: v}))}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.shortName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="border-t pt-3 mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={submit} disabled={!form.name || !form.email || update.isPending} data-testid="save-edit-user">
            {update.isPending ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type OverrideMap = Record<string, Partial<Record<Action, boolean | null>>>;

function effectiveValue(p: UserModulePermission, key: Action): boolean {
  const ov = p.override?.[key];
  if (ov === true || ov === false) return ov;
  return Boolean(p.roleDefault[key]);
}

function UserPermissionsDialog({
  userId, userName, open, onClose, isSuperAdmin,
}: { userId: number; userName: string; open: boolean; onClose: () => void; isSuperAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { data: perms, isLoading } = useGetUserPermissions(userId, { query: { queryKey: getGetUserPermissionsQueryKey(userId), enabled: open } });
  const [overrides, setOverrides] = useState<OverrideMap>({});

  useEffect(() => {
    if (!perms) return;
    const next: OverrideMap = {};
    for (const p of perms) {
      if (p.override) next[p.module] = { ...p.override };
    }
    setOverrides(next);
  }, [perms]);

  const update = useUpdateUserPermissions({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUserPermissionsQueryKey(userId) });
        onClose();
      },
    },
  });

  const cycleCell = (module: string, key: Action, roleDefault: boolean) => {
    setOverrides(prev => {
      const row = { ...(prev[module] ?? {}) };
      const current = row[key];
      // Cycle: inherit (undefined) -> opposite of roleDefault -> back to inherit
      if (current === undefined || current === null) {
        row[key] = !roleDefault;
      } else {
        delete row[key];
      }
      const next = { ...prev };
      if (Object.keys(row).length === 0) delete next[module];
      else next[module] = row;
      return next;
    });
  };

  const save = () => {
    const payload = Object.entries(overrides).map(([module, ov]) => ({
      module,
      canView: ov.canView ?? null,
      canCreate: ov.canCreate ?? null,
      canEdit: ov.canEdit ?? null,
      canApprove: ov.canApprove ?? null,
      canDelete: ov.canDelete ?? null,
      canExport: ov.canExport ?? null,
      canPrint: ov.canPrint ?? null,
    }));
    update.mutate({ id: userId, data: { permissions: payload } });
  };

  const overrideCount = useMemo(() => Object.values(overrides).reduce((acc, ov) => acc + Object.keys(ov).length, 0), [overrides]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="user-permissions-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#1e6ab0]" />
            Per-user overrides — {userName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Click a cell to override the role default. Filled checkbox = explicit allow, X = explicit deny, blank = inherit role permission.
            <span className="ml-2 font-medium">{overrideCount} active override{overrideCount === 1 ? "" : "s"}.</span>
          </p>
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
                    <TableHead key={a} className="text-center text-[11px] uppercase tracking-wider">{ACTION_LABELS[a]}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(perms ?? []).map(p => (
                  <TableRow key={p.module} data-testid={`user-perm-row-${p.module}`}>
                    <TableCell className="font-mono text-xs capitalize">{p.module.replace(/_/g, " ")}</TableCell>
                    {ACTIONS.map(a => {
                      const roleDefault = Boolean(p.roleDefault[a]);
                      const ov = overrides[p.module]?.[a];
                      const hasOverride = ov === true || ov === false;
                      const effective = hasOverride ? Boolean(ov) : roleDefault;
                      return (
                        <TableCell key={a} className="text-center">
                          <button
                            type="button"
                            disabled={!isSuperAdmin}
                            onClick={() => cycleCell(p.module, a, roleDefault)}
                            data-testid={`user-perm-${p.module}-${a}`}
                            className={[
                              "inline-flex items-center justify-center w-6 h-6 rounded border text-xs font-semibold",
                              effective ? "bg-emerald-500 text-white border-emerald-600" : "bg-rose-100 text-rose-700 border-rose-300",
                              hasOverride ? "ring-2 ring-amber-400 ring-offset-1" : "opacity-90",
                              !isSuperAdmin ? "cursor-not-allowed opacity-60" : "hover:opacity-100 cursor-pointer",
                            ].join(" ")}
                            title={hasOverride ? `Override (was ${roleDefault ? "✓" : "✗"})` : "Inherits from role"}
                          >
                            {effective ? "✓" : "✗"}
                          </button>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter className="border-t pt-3">
          {!isSuperAdmin && (
            <p className="text-xs text-muted-foreground mr-auto self-center">
              Only super admins can modify per-user permission overrides.
            </p>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-[#0f2d5a] hover:bg-[#1e6ab0]"
            disabled={!isSuperAdmin || update.isPending}
            onClick={save}
            data-testid="save-user-permissions"
          >
            {update.isPending ? "Saving..." : `Save ${overrideCount} override${overrideCount === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UsersList() {
  const { user: me } = useAuth();
  const isSuperAdmin = (me as { permissionLevel?: string } | undefined)?.permissionLevel === "super_admin";

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditableUser | null>(null);
  const [permsFor, setPermsFor] = useState<{ id: number; name: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "user", departmentId: "none", companyId: "all", permissionLevel: "user" });
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useListUsers();
  const { data: companies } = useListCompanies();
  const { data: departments } = useListDepartments();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
  const create = useCreateUser({ mutation: { onSuccess: () => { invalidate(); setOpen(false); } } });
  const update = useUpdateUser({ mutation: { onSuccess: invalidate } });

  const filtered = users?.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const submit = () => {
    const allCompanyIds = (companies ?? []).map(c => c.id);
    const isBoth = form.companyId === "all";
    const primary = isBoth ? (allCompanyIds[0] ?? undefined) : parseInt(form.companyId, 10);
    const cids = isBoth ? allCompanyIds : (primary ? [primary] : []);
    create.mutate({
      data: {
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        role: form.role,
        permissionLevel: form.permissionLevel,
        departmentId: form.departmentId !== "none" ? parseInt(form.departmentId, 10) : undefined,
        companyId: primary,
        companyIds: cids.length ? cids : undefined,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage system users, departments, permission levels and per-user overrides.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-[#0f2d5a] hover:bg-[#1e6ab0]" data-testid="add-user-trigger"><Plus className="w-4 h-4 mr-2" />Add User</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New User</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1 col-span-2"><Label>Full Name *</Label><Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Password *</Label><Input type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} /></div>
              <div className="space-y-1"><Label>Department Code</Label>
                <Select value={form.role} onValueChange={v => setForm(p => ({...p, role: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r.replace("_"," ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Permission Level</Label>
                <Select value={form.permissionLevel} onValueChange={v => setForm(p => ({...p, permissionLevel: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PERMISSION_LEVELS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Department</Label>
                <Select value={form.departmentId} onValueChange={v => setForm(p => ({...p, departmentId: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {departments?.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Primary Company</Label>
                <Select value={form.companyId} onValueChange={v => setForm(p => ({...p, companyId: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Both Companies</SelectItem>
                    {companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.shortName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="mt-4 bg-[#0f2d5a] hover:bg-[#1e6ab0]" onClick={submit} disabled={!form.name || !form.email || !form.password || create.isPending}>
              {create.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search users..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Permission</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow> :
            filtered?.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No users found.</TableCell></TableRow> :
            filtered?.map(u => {
              const lvl = (u as { permissionLevel?: string }).permissionLevel ?? "user";
              const lvlMeta = PERMISSION_LEVELS.find(p => p.value === lvl);
              const lastLogin = (u as { lastLoginAt?: string }).lastLoginAt;
              const departmentId = (u as { departmentId?: number | null }).departmentId ?? null;
              const companyId = (u as { companyId?: number | null }).companyId ?? null;
              const phone = (u as { phone?: string | null }).phone ?? null;
              return (
                <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`${lvlMeta?.color ?? ""} text-[10px]`}>
                      {lvlMeta?.label ?? lvl}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(u as { departmentName?: string }).departmentName ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(u as { companyName?: string }).companyName ?? "All"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {lastLogin ? new Date(lastLogin).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={u.isActive ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                      {u.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Edit user"
                        data-testid={`edit-user-${u.id}`}
                        onClick={() => setEditing({
                          id: u.id, name: u.name, email: u.email, phone, role: u.role,
                          isActive: u.isActive, permissionLevel: lvl, departmentId, companyId,
                        })}
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#1e6ab0]" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Per-user permissions"
                        data-testid={`perms-user-${u.id}`}
                        onClick={() => setPermsFor({ id: u.id, name: u.name })}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-[#1e6ab0]" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title={u.isActive ? "Deactivate" : "Activate"}
                        data-testid={`toggle-user-${u.id}`}
                        onClick={() => update.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                      >
                        <Power className={`w-3.5 h-3.5 ${u.isActive ? "text-emerald-600" : "text-muted-foreground"}`} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <EditUserDialog
          user={editing}
          open={!!editing}
          onClose={() => setEditing(null)}
          departments={departments ?? []}
          companies={companies ?? []}
        />
      )}
      {permsFor && (
        <UserPermissionsDialog
          userId={permsFor.id}
          userName={permsFor.name}
          open={!!permsFor}
          onClose={() => setPermsFor(null)}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </div>
  );
}
