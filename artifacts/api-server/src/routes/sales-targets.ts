import { Router } from "express";
import { db, salesTargetsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

async function enrich(t: typeof salesTargetsTable.$inferSelect) {
  let userName: string | undefined;
  if (t.userId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, t.userId));
    userName = u?.name;
  }
  return { ...t, userName };
}

router.get("/sales-targets", requirePermission("projects", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(salesTargetsTable).orderBy(sql`${salesTargetsTable.year} desc, ${salesTargetsTable.month} desc`);
  rows = scopeFilter(req, rows);
  const { userId, year, period } = req.query;
  if (userId) rows = rows.filter(r => r.userId === parseInt(userId as string, 10));
  if (year) rows = rows.filter(r => r.year === parseInt(year as string, 10));
  if (period) rows = rows.filter(r => r.period === period);
  res.json(await Promise.all(rows.map(enrich)));
});

router.post("/sales-targets", requirePermission("projects", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const [row] = await db.insert(salesTargetsTable).values(req.body).returning();
  res.status(201).json(await enrich(row));
});

router.put("/sales-targets/:id", requirePermission("projects", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(salesTargetsTable).where(eq(salesTargetsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [row] = await db.update(salesTargetsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(salesTargetsTable.id, id)).returning();
  res.json(await enrich(row));
});

router.delete("/sales-targets/:id", requirePermission("projects", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(salesTargetsTable).where(eq(salesTargetsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(salesTargetsTable).where(eq(salesTargetsTable.id, id));
  res.json({ ok: true });
});

export default router;
