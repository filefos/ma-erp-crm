import { Router } from "express";
import { db, usersTable, companiesTable, departmentsTable, userCompanyAccessTable } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requireAuth, requirePermissionLevel } from "../middlewares/auth";
import type { Request } from "express";
import { hashPassword } from "../lib/auth";
import { audit } from "../lib/audit";
import { genUserCode } from "../lib/client-code";
import { validateBody } from "../middlewares/validate";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

const PERMISSION_RANK: Record<string, number> = {
  super_admin: 100, company_admin: 90, department_admin: 80,
  manager: 70, user: 50, data_entry: 30, viewer: 10,
};

/**
 * Anti privilege-escalation: an admin may assign a permissionLevel only if
 *  - the assigned rank is <= caller's own rank, AND
 *  - super_admin may only be granted by another super_admin.
 * Returns null on success or an error message string.
 */
function checkPermissionAssignment(callerLevel: string, assignedLevel: string | undefined | null): string | null {
  if (!assignedLevel) return null;
  if (!(assignedLevel in PERMISSION_RANK)) return `Unknown permissionLevel "${assignedLevel}"`;
  const callerRank = PERMISSION_RANK[callerLevel] ?? 0;
  const assignedRank = PERMISSION_RANK[assignedLevel];
  if (assignedRank > callerRank) return `Cannot assign permissionLevel "${assignedLevel}" — exceeds your own access`;
  if (assignedLevel === "super_admin" && callerLevel !== "super_admin") return "Only super_admin may grant super_admin";
  return null;
}

/**
 * Returns the set of user ids visible to the caller given their company scope.
 * super_admin (companyScope === null) sees all. Others see users whose
 * primary companyId OR any user_company_access row falls inside their scope.
 */
async function visibleUserIds(req: Request): Promise<number[] | null> {
  if (req.companyScope === null || req.companyScope === undefined) return null;
  if (req.companyScope.length === 0) return [];
  const cids = req.companyScope;
  const [primary, access] = await Promise.all([
    db.select({ id: usersTable.id }).from(usersTable).where(inArray(usersTable.companyId, cids)),
    db.select({ id: userCompanyAccessTable.userId }).from(userCompanyAccessTable).where(inArray(userCompanyAccessTable.companyId, cids)),
  ]);
  const set = new Set<number>();
  for (const r of primary) set.add(r.id);
  for (const r of access) set.add(r.id);
  // The caller can always see themselves.
  if (req.user) set.add(req.user.id);
  return [...set];
}

async function userInScope(req: Request, userId: number): Promise<boolean> {
  const ids = await visibleUserIds(req);
  if (ids === null) return true;
  return ids.includes(userId);
}

async function enrichUser(user: typeof usersTable.$inferSelect) {
  let companyName: string | undefined;
  let departmentName: string | undefined;
  if (user.companyId) {
    const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, user.companyId));
    companyName = co?.name;
  }
  if (user.departmentId) {
    const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, user.departmentId));
    departmentName = dept?.name;
  }
  const { passwordHash: _, ...u } = user;
  return { ...u, companyName, departmentName };
}

router.get("/users", requirePermissionLevel("company_admin"), async (req, res): Promise<void> => {
  const visible = await visibleUserIds(req);
  let users: (typeof usersTable.$inferSelect)[];
  if (visible === null) {
    users = await db.select().from(usersTable).orderBy(usersTable.name);
  } else if (visible.length === 0) {
    users = [];
  } else {
    users = await db.select().from(usersTable).where(inArray(usersTable.id, visible)).orderBy(usersTable.name);
  }
  const enriched = await Promise.all(users.map(enrichUser));
  res.json(enriched);
});

router.post("/users", requirePermissionLevel("company_admin"), validateBody(CreateUserBody), async (req, res): Promise<void> => {
  const { name, email, password, phone, role, departmentId, companyId, permissionLevel, companyIds } = req.body;
  // Extra runtime invariants the OpenAPI schema doesn't capture (password length, lowercase email).
  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  const callerLevel = req.user!.permissionLevel ?? "user";
  const assignErr = checkPermissionAssignment(callerLevel, permissionLevel);
  if (assignErr) {
    res.status(403).json({ error: "Forbidden", message: assignErr });
    return;
  }

  // Tenant isolation: every targeted company must be inside the caller's scope.
  const scope = req.companyScope;
  const allTargetCompanies: number[] = [];
  if (typeof companyId === "number") allTargetCompanies.push(companyId);
  if (Array.isArray(companyIds)) for (const c of companyIds) if (typeof c === "number") allTargetCompanies.push(c);
  if (scope !== null && scope !== undefined) {
    const allowed = new Set(scope);
    for (const c of allTargetCompanies) {
      if (!allowed.has(c)) {
        res.status(403).json({ error: "Forbidden", message: `Cannot create user in company ${c} — outside your scope` });
        return;
      }
    }
    // Non-super_admin must place the user in at least one company they manage.
    if (allTargetCompanies.length === 0) {
      res.status(403).json({ error: "Forbidden", message: "Must specify a company within your scope" });
      return;
    }
  }

  const userCode = await genUserCode();
  const [user] = await db.insert(usersTable).values({
    name, email: email.toLowerCase(), passwordHash: await hashPassword(password),
    phone, role: role ?? "user", departmentId, companyId, permissionLevel: permissionLevel ?? "user",
    userCode,
  }).returning();

  // Maintain user_company_access rows
  const cids: number[] = Array.isArray(companyIds) && companyIds.length
    ? companyIds
    : (companyId ? [companyId] : []);
  if (cids.length) {
    await db.insert(userCompanyAccessTable).values(
      cids.map((cid: number) => ({ userId: user.id, companyId: cid, isPrimary: cid === companyId })),
    );
  }

  await audit(req, { action: "create", entity: "user", entityId: user.id, details: `Created user ${user.email} (${permissionLevel ?? "user"})` });
  const { passwordHash: _, ...u } = user;
  res.status(201).json(u);
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  // A user can fetch their own record; admins can fetch any inside their scope.
  const me = req.user!;
  const lvl = me.permissionLevel ?? "user";
  if (me.id !== id && lvl !== "super_admin" && lvl !== "company_admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (me.id !== id && !(await userInScope(req, id))) {
    res.status(403).json({ error: "Forbidden", message: "Target user is outside your company scope" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichUser(user));
});

router.put("/users/:id", requirePermissionLevel("company_admin"), validateBody(UpdateUserBody), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, email, phone, role, departmentId, companyId, companyIds, permissionLevel, isActive, status } = req.body;
  const [before] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!before) { res.status(404).json({ error: "Not found" }); return; }

  const callerLevel = req.user!.permissionLevel ?? "user";
  const callerRank = PERMISSION_RANK[callerLevel] ?? 0;

  // Tenant isolation: only super_admin can mutate users outside their company scope.
  if (req.user!.id !== id && !(await userInScope(req, id))) {
    res.status(403).json({ error: "Forbidden", message: "Target user is outside your company scope" });
    return;
  }
  // Cannot move a user to a company outside your scope.
  if (companyId !== undefined && req.companyScope && req.companyScope.length > 0 && !req.companyScope.includes(companyId)) {
    res.status(403).json({ error: "Forbidden", message: `Cannot move user to company ${companyId} — outside your scope` });
    return;
  }
  // companyIds management: every supplied id must be inside caller's scope.
  if (Array.isArray(companyIds) && req.companyScope && req.companyScope.length > 0) {
    const allowed = new Set(req.companyScope);
    for (const c of companyIds) {
      if (!allowed.has(c)) {
        res.status(403).json({ error: "Forbidden", message: `Cannot grant access to company ${c} — outside your scope` });
        return;
      }
    }
  }

  // Cannot edit a user who outranks you. super_admin can only be edited by super_admin.
  const targetRank = PERMISSION_RANK[before.permissionLevel ?? "user"] ?? 0;
  if (targetRank > callerRank && req.user!.id !== id) {
    res.status(403).json({ error: "Forbidden", message: "Cannot modify a user with higher access than yours" });
    return;
  }
  if (before.permissionLevel === "super_admin" && callerLevel !== "super_admin" && req.user!.id !== id) {
    res.status(403).json({ error: "Forbidden", message: "Only super_admin may modify super_admin users" });
    return;
  }
  // Cannot promote them to a level above your own (or super_admin unless you are one).
  if (permissionLevel !== undefined) {
    const assignErr = checkPermissionAssignment(callerLevel, permissionLevel);
    if (assignErr) {
      res.status(403).json({ error: "Forbidden", message: assignErr });
      return;
    }
  }

  const [user] = await db.update(usersTable).set({
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email: email.toLowerCase() }),
    ...(phone !== undefined && { phone }),
    ...(role !== undefined && { role }),
    ...(departmentId !== undefined && { departmentId }),
    ...(companyId !== undefined && { companyId }),
    ...(permissionLevel !== undefined && { permissionLevel }),
    ...(isActive !== undefined && { isActive }),
    ...(status !== undefined && { status }),
    updatedAt: new Date(),
  }).where(eq(usersTable.id, id)).returning();

  // Sync user_company_access rows when companyIds is supplied. For
  // company_admin we only manage rows inside their scope so they cannot
  // strip out access to companies they don't manage. super_admin replaces
  // the entire set.
  if (Array.isArray(companyIds)) {
    const finalPrimary = companyId ?? user.companyId;
    if (req.companyScope === null || req.companyScope === undefined) {
      await db.delete(userCompanyAccessTable).where(eq(userCompanyAccessTable.userId, id));
    } else if (req.companyScope.length > 0) {
      await db.delete(userCompanyAccessTable).where(
        and(eq(userCompanyAccessTable.userId, id), inArray(userCompanyAccessTable.companyId, req.companyScope)),
      );
    }
    if (companyIds.length) {
      await db.insert(userCompanyAccessTable).values(
        companyIds.map((cid: number) => ({ userId: id, companyId: cid, isPrimary: cid === finalPrimary })),
      );
    }
  }

  await audit(req, { action: "update", entity: "user", entityId: id, details: `Updated user ${user.email}` });
  if (isActive === false || status === "inactive") {
    await audit(req, { action: "deactivate", entity: "user", entityId: id, details: `Deactivated user ${user.email}` });
  }
  res.json(await enrichUser(user));
});

router.post("/users/:id/change-password", requirePermissionLevel("company_admin"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { newPassword } = req.body;
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const callerLevel = req.user!.permissionLevel ?? "user";
  const callerRank = PERMISSION_RANK[callerLevel] ?? 0;

  // Tenant isolation: target user must be within the caller's company scope.
  if (!(await userInScope(req, id))) {
    res.status(403).json({ error: "Forbidden", message: "Target user is outside your company scope" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }

  // Rank protection: cannot reset a password for a user of higher rank.
  // super_admin can reset ANY user's password (including other super_admins),
  // since the super_admin role is the ultimate operator of the system.
  const targetRank = PERMISSION_RANK[user.permissionLevel ?? "user"] ?? 0;
  if (callerLevel !== "super_admin" && targetRank >= callerRank && req.user!.id !== id) {
    res.status(403).json({ error: "Forbidden", message: "Cannot reset password for a user with equal or higher access than yours" });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(usersTable).set({ passwordHash, updatedAt: new Date() }).where(eq(usersTable.id, id));
  await audit(req, { action: "update", entity: "user", entityId: id, details: `Password reset by ${req.user!.email} for user ${user.email}` });
  res.json({ success: true });
});

router.put("/users/:id/signature", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (req.user?.id !== id) {
    res.status(403).json({ error: "You can only update your own signature" });
    return;
  }
  const { signatureUrl } = req.body;
  await db.execute(sql`UPDATE users SET signature_url = ${signatureUrl}, updated_at = NOW() WHERE id = ${id}`);
  res.json({ success: true });
});

router.delete("/users/:id", requirePermissionLevel("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [before] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  await db.update(usersTable).set({ isActive: false, status: "inactive" }).where(eq(usersTable.id, id));
  await audit(req, { action: "deactivate", entity: "user", entityId: id, details: `Soft-deleted user ${before?.email ?? id}` });
  res.json({ success: true });
});

export default router;
