import { Request, Response, NextFunction } from "express";
import { getUserFromToken } from "../lib/auth";
import type { User } from "@workspace/db";
import { db, userPermissionsTable, permissionsTable, rolesTable, userCompanyAccessTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

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
