import { Router } from "express";
import { db, rolesTable, permissionsTable, userPermissionsTable, usersTable, userCompanyAccessTable } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Request } from "express";
import { requireAuth, requirePermissionLevel } from "../middlewares/auth";
import { audit } from "../lib/audit";
import { validateBody } from "../middlewares/validate";
import { UpdateRolePermissionsBody, UpdateUserPermissionsBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

const PERMISSION_RANK: Record<string, number> = {
  super_admin: 100, company_admin: 90, department_admin: 80,
  manager: 70, user: 50, data_entry: 30, viewer: 10,
};

/**
 * Returns true if userId is inside the caller's company scope (or caller is
 * super_admin with global scope). Looks at the target's primary companyId AND
 * the user_company_access table.
 */
async function targetUserInScope(req: Request, userId: number): Promise<boolean> {
  if (req.companyScope === null || req.companyScope === undefined) return true;
  if (req.companyScope.length === 0) return false;
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!target) return false;
  const allowed = new Set(req.companyScope);
  if (target.companyId != null && allowed.has(target.companyId)) return true;
  const access = await db.select({ companyId: userCompanyAccessTable.companyId })
    .from(userCompanyAccessTable)
    .where(and(eq(userCompanyAccessTable.userId, userId), inArray(userCompanyAccessTable.companyId, req.companyScope)));
  return access.length > 0;
}

const ACTION_COLS = ["canView", "canCreate", "canEdit", "canApprove", "canDelete", "canExport", "canPrint"] as const;
type ActionCol = typeof ACTION_COLS[number];

// Authoritative module list mirrors scripts/src/seed.ts MODULES
const MODULES = [
  "dashboard", "leads", "contacts", "deals", "activities",
  "quotations", "proforma_invoices", "lpos", "tax_invoices", "delivery_notes",
  "expenses", "cheques", "bank_accounts",
  "suppliers", "purchase_requests", "purchase_orders",
  "inventory_items", "stock_entries", "assets",
  "projects",
  "employees", "attendance", "offer_letters",
  "users", "companies", "departments", "roles", "audit_logs",
  "emails", "whatsapp",
] as const;

router.get("/roles", requirePermissionLevel("company_admin"), async (_req, res): Promise<void> => {
  const roles = await db.select().from(rolesTable).orderBy(sql`${rolesTable.permissionLevel} desc`);
  // Annotate with permission row count and assigned user count.
  const out = await Promise.all(roles.map(async (r) => {
    const [pc] = await db.select({ count: sql<number>`count(*)::int` }).from(permissionsTable).where(eq(permissionsTable.roleId, r.id));
    const [uc] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.role, r.code));
    return { ...r, permissionCount: pc?.count ?? 0, userCount: uc?.count ?? 0 };
  }));
  res.json(out);
});

router.get("/roles/:id/permissions", requirePermissionLevel("company_admin"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id));
  if (!role) { res.status(404).json({ error: "Not found" }); return; }
  const rows = await db.select().from(permissionsTable).where(eq(permissionsTable.roleId, id));
  // Always return one row per known module so the UI matrix is complete.
  const byModule = new Map(rows.map(r => [r.module, r]));
  const out = MODULES.map(m => {
    const r = byModule.get(m);
    return {
      module: m,
      canView: r?.canView ?? false,
      canCreate: r?.canCreate ?? false,
      canEdit: r?.canEdit ?? false,
      canApprove: r?.canApprove ?? false,
      canDelete: r?.canDelete ?? false,
      canExport: r?.canExport ?? false,
      canPrint: r?.canPrint ?? false,
    };
  });
  res.json(out);
});

interface PermissionRowInput {
  module: string;
  canView?: boolean | null;
  canCreate?: boolean | null;
  canEdit?: boolean | null;
  canApprove?: boolean | null;
  canDelete?: boolean | null;
  canExport?: boolean | null;
  canPrint?: boolean | null;
}

router.put("/roles/:id/permissions", requirePermissionLevel("super_admin"), validateBody(UpdateRolePermissionsBody), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id));
  if (!role) { res.status(404).json({ error: "Not found" }); return; }
  const incoming = req.body.permissions as PermissionRowInput[];
  // Atomic-ish: wipe and re-insert.
  await db.delete(permissionsTable).where(eq(permissionsTable.roleId, id));
  if (incoming.length) {
    await db.insert(permissionsTable).values(
      incoming.map((p: PermissionRowInput) => ({
        roleId: id,
        module: p.module,
        canView: !!p.canView,
        canCreate: !!p.canCreate,
        canEdit: !!p.canEdit,
        canApprove: !!p.canApprove,
        canDelete: !!p.canDelete,
        canExport: !!p.canExport,
        canPrint: !!p.canPrint,
      })),
    );
  }
  await audit(req, { action: "update", entity: "role_permissions", entityId: id, details: `Updated ${incoming.length} permissions for role ${role.name}` });
  res.json({ success: true, count: incoming.length });
});

router.get("/users/:id/permissions", async (req, res): Promise<void> => {
  const userId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const me = req.user!;
  const callerLvl = me.permissionLevel ?? "user";
  // Self-access is always allowed so the frontend ModuleGuard can resolve
  // the current user's effective permissions; otherwise require admin.
  if (me.id !== userId) {
    if (callerLvl !== "super_admin" && callerLvl !== "company_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!(await targetUserInScope(req, userId))) {
      res.status(403).json({ error: "Forbidden", message: "Target user is outside your company scope" });
      return;
    }
  }
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!u) { res.status(404).json({ error: "Not found" }); return; }
  const overrides = await db.select().from(userPermissionsTable).where(eq(userPermissionsTable.userId, userId));
  const byModule = new Map(overrides.map(o => [o.module, o]));
  // Merge with role defaults so the UI knows the effective baseline + any user overrides.
  // Roles are seeded by permissionLevel codes; user.role is the department/function code.
  const lvl = u.permissionLevel ?? "user";
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.code, lvl));
  const rolePerms = role
    ? await db.select().from(permissionsTable).where(eq(permissionsTable.roleId, role.id))
    : [];
  const roleByModule = new Map(rolePerms.map(p => [p.module, p]));
  const out = MODULES.map(m => {
    const o = byModule.get(m);
    const base = roleByModule.get(m);
    return {
      module: m,
      // role default for the matrix display
      roleDefault: {
        canView: base?.canView ?? false,
        canCreate: base?.canCreate ?? false,
        canEdit: base?.canEdit ?? false,
        canApprove: base?.canApprove ?? false,
        canDelete: base?.canDelete ?? false,
        canExport: base?.canExport ?? false,
        canPrint: base?.canPrint ?? false,
      },
      // override (nullable booleans — null = "use role default")
      override: o ? {
        canView: o.canView, canCreate: o.canCreate, canEdit: o.canEdit,
        canApprove: o.canApprove, canDelete: o.canDelete, canExport: o.canExport, canPrint: o.canPrint,
      } : null,
    };
  });
  res.json(out);
});

router.put("/users/:id/permissions", requirePermissionLevel("company_admin"), validateBody(UpdateUserPermissionsBody), async (req, res): Promise<void> => {
  const userId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!u) { res.status(404).json({ error: "Not found" }); return; }
  // Tenant isolation + rank check: company_admin may only override permissions
  // for users in their company, and never for someone of equal or higher rank.
  const callerLevel = req.user!.permissionLevel ?? "user";
  const callerRank = PERMISSION_RANK[callerLevel] ?? 0;
  const targetRank = PERMISSION_RANK[u.permissionLevel ?? "user"] ?? 0;
  if (callerLevel !== "super_admin") {
    if (!(await targetUserInScope(req, userId))) {
      res.status(403).json({ error: "Forbidden", message: "Target user is outside your company scope" });
      return;
    }
    if (targetRank >= callerRank) {
      res.status(403).json({ error: "Forbidden", message: "Cannot modify permissions for a user of equal or higher rank" });
      return;
    }
  }
  const incoming = req.body.permissions as PermissionRowInput[];
  await db.delete(userPermissionsTable).where(eq(userPermissionsTable.userId, userId));
  // Only insert rows that have at least one non-null override.
  const valuable = incoming.filter((p: PermissionRowInput) =>
    typeof p?.module === "string" && ACTION_COLS.some((k) => p[k] === true || p[k] === false),
  );
  if (valuable.length) {
    await db.insert(userPermissionsTable).values(
      valuable.map((p: PermissionRowInput) => {
        const row: Record<string, unknown> = { userId, module: p.module };
        for (const k of ACTION_COLS) {
          row[k] = p[k] === true ? true : p[k] === false ? false : null;
        }
        return row as unknown as typeof userPermissionsTable.$inferInsert;
      }),
    );
  }
  await audit(req, { action: "update", entity: "user_permissions", entityId: userId, details: `Updated ${valuable.length} permission overrides for ${u.email}` });
  res.json({ success: true, count: valuable.length });
});

export default router;
// Export ACTION_COLS and MODULES for any consumer that needs them.
export { ACTION_COLS, MODULES };
export type { ActionCol };
