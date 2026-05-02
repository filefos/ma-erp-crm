import { Router } from "express";
import { db, usersTable, companiesTable, departmentsTable, userCompanyAccessTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken } from "../lib/auth";
import { requireAuth } from "../middlewares/auth";
import { audit } from "../lib/audit";

const router = Router();

router.get("/auth/companies", async (_req, res): Promise<void> => {
  const companies = await db.select({
    id: companiesTable.id,
    name: companiesTable.name,
    shortName: companiesTable.shortName,
    prefix: companiesTable.prefix,
  }).from(companiesTable).where(eq(companiesTable.isActive, true)).orderBy(companiesTable.id);
  res.json(companies);
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password, companyId: requestedCompanyId } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const normalized = String(email).toLowerCase().trim();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalized));
  if (!user || !user.isActive) {
    await audit(req, { action: "login_failed", entity: "auth", details: `Login failed for ${normalized} (user not found or inactive)`, userName: normalized });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await audit(req, { action: "login_failed", entity: "auth", entityId: user.id, details: `Login failed for ${normalized} (bad password)`, userId: user.id, userName: user.name });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Compute accessible companies BEFORE issuing token, so we can validate the
  // requested company workspace.
  const access = await db.select().from(userCompanyAccessTable).where(eq(userCompanyAccessTable.userId, user.id));
  const allCos = await db.select().from(companiesTable);
  const accessibleCompanies = access.length
    ? access
        .map(a => allCos.find(c => c.id === a.companyId))
        .filter((c): c is typeof allCos[number] => Boolean(c))
        .map(c => ({ id: c.id, name: c.name, shortName: c.shortName, prefix: c.prefix }))
    // Fallback: users without user_company_access rows use their primary companyId.
    : user.companyId
      ? allCos.filter(c => c.id === user.companyId).map(c => ({ id: c.id, name: c.name, shortName: c.shortName, prefix: c.prefix }))
      : [];

  let activeCompanyId: number | null = user.companyId ?? null;
  if (requestedCompanyId !== undefined && requestedCompanyId !== null) {
    const reqId = Number(requestedCompanyId);
    if (!Number.isFinite(reqId) || !accessibleCompanies.some(c => c.id === reqId)) {
      await audit(req, { action: "login_failed", entity: "auth", entityId: user.id, details: `${user.email} attempted login with disallowed company ${reqId}`, userId: user.id, userName: user.name });
      res.status(403).json({ error: "You do not have access to that company workspace" });
      return;
    }
    activeCompanyId = reqId;
  }

  const token = generateToken(user.id);

  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  let companyName: string | undefined;
  let departmentName: string | undefined;
  if (activeCompanyId) {
    const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, activeCompanyId));
    companyName = co?.name;
  }
  if (user.departmentId) {
    const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, user.departmentId));
    departmentName = dept?.name;
  }

  await audit(req, { action: "login", entity: "auth", entityId: user.id, details: `${user.email} signed in to ${companyName ?? "default workspace"}`, userId: user.id, userName: user.name });

  const { passwordHash: _, ...userWithoutHash } = user;
  res.json({
    user: { ...userWithoutHash, companyId: activeCompanyId, companyName, departmentName, accessibleCompanies },
    token,
  });
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  await audit(req, { action: "logout", entity: "auth", entityId: req.user!.id, details: `${req.user!.email} signed out` });
  res.json({ success: true, message: "Logged out" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
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
  const access = await db.select().from(userCompanyAccessTable).where(eq(userCompanyAccessTable.userId, user.id));
  const allCos = await db.select().from(companiesTable);
  const accessibleCompanies = access.length
    ? access
        .map(a => allCos.find(c => c.id === a.companyId))
        .filter((c): c is typeof allCos[number] => Boolean(c))
        .map(c => ({ id: c.id, name: c.name, shortName: c.shortName, prefix: c.prefix }))
    : user.companyId
      ? allCos.filter(c => c.id === user.companyId).map(c => ({ id: c.id, name: c.name, shortName: c.shortName, prefix: c.prefix }))
      : [];
  const { passwordHash: _, ...userWithoutHash } = user;
  res.json({ ...userWithoutHash, companyName, departmentName, accessibleCompanies });
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Missing fields" });
    return;
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }
  const user = req.user!;
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    res.status(400).json({ error: "Current password incorrect" });
    return;
  }
  const newHash = await hashPassword(newPassword);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));
  await audit(req, { action: "change_password", entity: "user", entityId: user.id, details: `${user.email} changed their password` });
  res.json({ success: true });
});

export default router;
