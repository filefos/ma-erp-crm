import { Router } from "express";
import { db, usersTable, companiesTable, departmentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { hashPassword } from "../lib/auth";

const router = Router();
router.use(requireAuth);

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

router.get("/users", async (req, res): Promise<void> => {
  let query = db.select().from(usersTable);
  const users = await query.orderBy(usersTable.name);
  const enriched = await Promise.all(users.map(enrichUser));
  res.json(enriched);
});

router.post("/users", async (req, res): Promise<void> => {
  const { name, email, password, phone, role, departmentId, companyId, permissionLevel } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: "Name, email and password required" });
    return;
  }
  const [user] = await db.insert(usersTable).values({
    name, email: email.toLowerCase(), passwordHash: hashPassword(password),
    phone, role: role ?? "sales", departmentId, companyId, permissionLevel: permissionLevel ?? "user",
  }).returning();
  const { passwordHash: _, ...u } = user;
  res.status(201).json(u);
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichUser(user));
});

router.put("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, email, phone, role, departmentId, companyId, permissionLevel, isActive } = req.body;
  const [user] = await db.update(usersTable).set({
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email: email.toLowerCase() }),
    ...(phone !== undefined && { phone }),
    ...(role !== undefined && { role }),
    ...(departmentId !== undefined && { departmentId }),
    ...(companyId !== undefined && { companyId }),
    ...(permissionLevel !== undefined && { permissionLevel }),
    ...(isActive !== undefined && { isActive }),
    updatedAt: new Date(),
  }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichUser(user));
});

router.delete("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.update(usersTable).set({ isActive: false }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

export default router;
