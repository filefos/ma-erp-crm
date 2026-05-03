import { Request, Response, NextFunction } from "express";
import { getUserFromToken } from "../lib/auth";
import type { User } from "@workspace/db";
import { db, userPermissionsTable, permissionsTable, rolesTable, userCompanyAccessTable, usersTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      // null = unrestricted (super_admin); array = explicit company ids the
      // caller may see. Set automatically by requireAuth.
      companyScope?: number[] | null;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const user = await getUserFromToken(token);
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.user = user;
  // Attach company scope so downstream filters can enforce multi-company isolation.
  if (user.permissionLevel === "super_admin") {
    req.companyScope = null;
  } else {
    const rows = await db.select({ companyId: userCompanyAccessTable.companyId })
      .from(userCompanyAccessTable)
      .where(eq(userCompanyAccessTable.userId, user.id));
    const ids = rows.map(r => r.companyId).filter((x): x is number => typeof x === "number");
    if (ids.length === 0 && user.companyId) ids.push(user.companyId);
    req.companyScope = ids;
  }
  next();
}

/**
 * Returns true if the caller may access data belonging to companyId.
 * Treats null/undefined companyId as global (always visible).
 */
export function inScope(req: Request, companyId: number | null | undefined): boolean {
  if (companyId == null) return true;
  if (req.companyScope === null || req.companyScope === undefined) return true;
  return req.companyScope.includes(companyId);
}

/**
 * Filters rows to those whose companyId is in the caller's allowed set.
 * Rows with null companyId are kept (global rows).
 */
export function scopeFilter<T extends { companyId?: number | null }>(req: Request, rows: T[]): T[] {
  if (req.companyScope === null || req.companyScope === undefined) return rows;
  const allowed = new Set(req.companyScope);
  return rows.filter(r => r.companyId == null || allowed.has(r.companyId));
}

/**
 * Body-validating middleware: rejects with 403 if the supplied companyId is
 * outside the caller's scope. Use on POST/PUT routes that accept companyId.
 */
export function requireBodyCompanyAccess(field: string = "companyId") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const cid = req.body?.[field];
    if (cid != null && !inScope(req, Number(cid))) {
      res.status(403).json({ error: "Forbidden", message: "You do not have access to that company" });
      return;
    }
    next();
  };
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await requireAuth(req, res, () => {
      if (!req.user || !roles.includes(req.user.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      next();
    });
  };
}

const PERMISSION_RANK: Record<string, number> = {
  super_admin: 100,
  company_admin: 90,
  department_admin: 80,
  manager: 70,
  user: 50,
  data_entry: 30,
  viewer: 10,
};

export function requirePermissionLevel(min: keyof typeof PERMISSION_RANK) {
  const minRank = PERMISSION_RANK[min] ?? 100;
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await requireAuth(req, res, () => {
      const lvl = req.user?.permissionLevel ?? "viewer";
      const rank = PERMISSION_RANK[lvl] ?? 0;
      if (rank < minRank) {
        res.status(403).json({ error: "Forbidden", message: `Requires ${min} or higher` });
        return;
      }
      next();
    });
  };
}

// ----------------------------------------------------------------------------
// Per-user / per-team ownership scoping (CRM + Sales modules)
// ----------------------------------------------------------------------------
//
// Rules:
//   - super_admin / company_admin → unrestricted (within company scope).
//   - department_admin / manager  → all users in the same department(s),
//                                   within the caller's company scope.
//   - user / data_entry / viewer  → only themselves.
// Records with NULL owner are HIDDEN from non-admin users.

export type OwnerScope =
  | { kind: "all" }
  | { kind: "users"; userIds: Set<number> };

const TEAM_LEADER_LEVELS = new Set(["department_admin", "manager"]);
const ADMIN_LEVELS = new Set(["super_admin", "company_admin"]);

export async function getOwnerScope(req: Request): Promise<OwnerScope> {
  const u = req.user;
  if (!u) return { kind: "users", userIds: new Set() };
  const lvl = u.permissionLevel ?? "user";
  if (ADMIN_LEVELS.has(lvl)) return { kind: "all" };
  if (TEAM_LEADER_LEVELS.has(lvl)) {
    const ids = new Set<number>([u.id]);
    if (u.departmentId != null) {
      const companyIds = req.companyScope ?? null;
      // Empty array means caller has no company access — never widen to all
      // companies; restrict the team lookup to the leader themselves.
      if (companyIds !== null && companyIds.length === 0) {
        return { kind: "users", userIds: ids };
      }
      const conds = [eq(usersTable.departmentId, u.departmentId)];
      if (companyIds && companyIds.length > 0) {
        conds.push(inArray(usersTable.companyId, companyIds));
      }
      const teammates = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(...conds));
      for (const t of teammates) ids.add(t.id);
    }
    return { kind: "users", userIds: ids };
  }
  return { kind: "users", userIds: new Set([u.id]) };
}

/** True if `ownerId` is allowed by the scope. NULL/undefined owners are not allowed for restricted scopes. */
export function inOwnerScope(scope: OwnerScope, ownerId: number | null | undefined): boolean {
  if (scope.kind === "all") return true;
  if (ownerId == null) return false;
  return scope.userIds.has(ownerId);
}

/**
 * Filters rows where ANY of the given owner fields matches the scope.
 * Use multiple owner fields when ownership can come from any of several
 * columns (e.g. preparedById OR approvedById on quotations).
 */
export function ownerScopeFilter<T extends Record<string, any>>(
  scope: OwnerScope,
  rows: T[],
  ownerFields: (keyof T)[],
): T[] {
  if (scope.kind === "all") return rows;
  return rows.filter(r => ownerFields.some(f => {
    const v = r[f];
    return typeof v === "number" && scope.userIds.has(v);
  }));
}

export function isAdmin(user?: User): boolean {
  if (!user) return false;
  const lvl = user.permissionLevel ?? "user";
  return lvl === "super_admin" || lvl === "company_admin";
}

type PermissionAction = "view" | "create" | "edit" | "approve" | "delete" | "export" | "print";
const ACTION_COLUMN: Record<PermissionAction, "canView" | "canCreate" | "canEdit" | "canApprove" | "canDelete" | "canExport" | "canPrint"> = {
  view: "canView", create: "canCreate", edit: "canEdit", approve: "canApprove",
  delete: "canDelete", export: "canExport", print: "canPrint",
};

/**
 * Programmatic version of requirePermission. Returns true/false instead of
 * sending a response. Use inside handlers when the required permission depends
 * on request body (e.g. AI suggest-followup which can target a lead OR a deal).
 */
export async function hasPermission(user: User | undefined, module: string, action: PermissionAction): Promise<boolean> {
  if (!user) return false;
  if (user.permissionLevel === "super_admin") return true;
  const col = ACTION_COLUMN[action];
  const [override] = await db.select().from(userPermissionsTable)
    .where(and(eq(userPermissionsTable.userId, user.id), eq(userPermissionsTable.module, module)));
  if (override && override[col] !== null && override[col] !== undefined) {
    return Boolean(override[col]);
  }
  const lvl = user.permissionLevel ?? "user";
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.code, lvl));
  if (!role) return false;
  const [perm] = await db.select().from(permissionsTable)
    .where(and(eq(permissionsTable.roleId, role.id), eq(permissionsTable.module, module)));
  return Boolean(perm?.[col]);
}

/**
 * Module-level permission check. Consults user_permissions overrides first,
 * then falls back to the role's permissions row. super_admin always passes.
 */
export function requirePermission(module: string, action: PermissionAction) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await requireAuth(req, res, async () => {
      const u = req.user!;
      if (u.permissionLevel === "super_admin") return next();
      const col = ACTION_COLUMN[action];

      const [override] = await db.select().from(userPermissionsTable)
        .where(and(eq(userPermissionsTable.userId, u.id), eq(userPermissionsTable.module, module)));
      if (override && override[col] !== null && override[col] !== undefined) {
        if (override[col]) return next();
        res.status(403).json({ error: "Forbidden", message: `Permission denied: ${module}.${action}` });
        return;
      }

      // Roles are seeded keyed by permissionLevel codes (super_admin, company_admin, manager, user, ...).
      // user.role is the department code (sales, accounts, ...), not a permission role.
      const lvl = u.permissionLevel ?? "user";
      const [role] = await db.select().from(rolesTable).where(eq(rolesTable.code, lvl));
      if (!role) {
        res.status(403).json({ error: "Forbidden", message: `No role found for permissionLevel ${lvl}` });
        return;
      }
      const [perm] = await db.select().from(permissionsTable)
        .where(and(eq(permissionsTable.roleId, role.id), eq(permissionsTable.module, module)));
      if (perm?.[col]) return next();

      res.status(403).json({ error: "Forbidden", message: `Permission denied: ${module}.${action}` });
    });
  };
}
