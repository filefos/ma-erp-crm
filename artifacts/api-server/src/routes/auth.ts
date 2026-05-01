import { Router } from "express";
import { db, usersTable, companiesTable, departmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, generateToken } from "../lib/auth";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const hashed = hashPassword(password);
  if (user.passwordHash !== hashed) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = generateToken(user.id);
  
  // Get company and department names
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

  const { passwordHash: _, ...userWithoutHash } = user;
  res.json({
    user: { ...userWithoutHash, companyName, departmentName },
    token,
  });
});

router.post("/auth/logout", (_req, res): Promise<void> => {
  res.json({ success: true, message: "Logged out" });
  return Promise.resolve();
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
  const { passwordHash: _, ...userWithoutHash } = user;
  res.json({ ...userWithoutHash, companyName, departmentName });
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Missing fields" });
    return;
  }
  const user = req.user!;
  if (hashPassword(currentPassword) !== user.passwordHash) {
    res.status(400).json({ error: "Current password incorrect" });
    return;
  }
  await db.update(usersTable).set({ passwordHash: hashPassword(newPassword) }).where(eq(usersTable.id, user.id));
  res.json({ success: true });
});

export default router;
