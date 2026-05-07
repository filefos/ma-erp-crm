import { Router } from "express";
import { db, usersTable, companiesTable, departmentsTable, userCompanyAccessTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken } from "../lib/auth";
import { requireAuth } from "../middlewares/auth";
import { audit } from "../lib/audit";
import { sendLoginAlert } from "../lib/login-notify";
import { storeOtp, verifyOtp } from "../lib/otp";
import { sendOtp, maskPhone } from "../lib/otp-send";

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

// Companies the currently authenticated user may switch into. Used by the
// company switcher in the app shell. Returns at most the user's allowed scope.
router.get("/auth/my-companies", requireAuth, async (req, res): Promise<void> => {
  const all = await db.select({
    id: companiesTable.id,
    name: companiesTable.name,
    shortName: companiesTable.shortName,
    prefix: companiesTable.prefix,
  }).from(companiesTable).where(eq(companiesTable.isActive, true)).orderBy(companiesTable.id);

  // NOTE: req.companyScope here may already be clamped to the active workspace
  // by the X-Active-Company-Id header. We intentionally re-read the user's
  // full access list so the switcher can show every workspace they may pick.
  const u = req.user!;
  if (u.permissionLevel === "super_admin") {
    res.json(all);
    return;
  }
  const access = await db.select({ companyId: userCompanyAccessTable.companyId })
    .from(userCompanyAccessTable)
    .where(eq(userCompanyAccessTable.userId, u.id));
  let ids = access.map(a => a.companyId).filter((x): x is number => typeof x === "number");
  if (ids.length === 0 && u.companyId) ids = [u.companyId];
  const allowed = new Set(ids);
  res.json(all.filter(c => allowed.has(c.id)));
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

  sendLoginAlert({
    loginUserName: user.name,
    loginUserEmail: user.email,
    companyName: companyName ?? "default workspace",
    ipAddress: req.ip ?? undefined,
  }).catch(() => {});

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

// ── OTP login: step 1 – request a code ─────────────────────────────────────
router.post("/auth/request-otp", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "email is required" });
    return;
  }

  const normalized = email.toLowerCase().trim();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalized));

  // Return a generic success even for unknown emails (don't leak existence).
  if (!user || !user.isActive) {
    res.json({ success: true, maskedPhone: null });
    return;
  }

  if (!user.phone) {
    res.status(422).json({ error: "No mobile number on file for this account. Contact your administrator." });
    return;
  }

  const code = storeOtp(normalized, user.id, user.phone);
  const result = await sendOtp({
    phone: user.phone,
    email: normalized,
    userName: user.name,
    code,
  });

  await audit(req, {
    action: "otp_requested",
    entity: "auth",
    entityId: user.id,
    details: `OTP requested for ${normalized} — whatsapp:${result.whatsapp} email:${result.email}`,
    userId: user.id,
    userName: user.name,
  });

  res.json({
    success: true,
    maskedPhone: maskPhone(user.phone),
    sentVia: { whatsapp: result.whatsapp, email: result.email },
  });
});

// ── OTP login: step 2 – verify and issue token ─────────────────────────────
router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const { email, otp, companyId: requestedCompanyId } = req.body;
  if (!email || !otp) {
    res.status(400).json({ error: "email and otp are required" });
    return;
  }

  const normalized = email.toLowerCase().trim();
  const result = verifyOtp(normalized, String(otp));

  if (!result.ok) {
    const messages: Record<string, string> = {
      not_found: "No OTP requested for this email. Please request a new one.",
      expired: "OTP has expired. Please request a new one.",
      invalid: "Incorrect OTP. Please try again.",
      too_many_attempts: "Too many incorrect attempts. Please request a new OTP.",
    };
    res.status(401).json({ error: messages[result.reason] ?? "Invalid OTP" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, result.userId));
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Account not found or inactive" });
    return;
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

  let activeCompanyId: number | null = user.companyId ?? null;
  if (requestedCompanyId !== undefined && requestedCompanyId !== null) {
    const reqId = Number(requestedCompanyId);
    if (Number.isFinite(reqId) && accessibleCompanies.some(c => c.id === reqId)) {
      activeCompanyId = reqId;
    }
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

  await audit(req, { action: "login_otp", entity: "auth", entityId: user.id, details: `${user.email} signed in via OTP to ${companyName ?? "default workspace"}`, userId: user.id, userName: user.name });

  sendLoginAlert({
    loginUserName: user.name,
    loginUserEmail: user.email,
    companyName: companyName ?? "default workspace",
    ipAddress: req.ip ?? undefined,
  }).catch(() => {});

  const { passwordHash: _, ...userWithoutHash } = user;
  res.json({
    user: { ...userWithoutHash, companyId: activeCompanyId, companyName, departmentName, accessibleCompanies },
    token,
  });
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
