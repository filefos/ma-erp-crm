import { Router } from "express";
import { db, dealsTable, usersTable, companiesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

async function enrichDeal(deal: typeof dealsTable.$inferSelect) {
  let assignedToName: string | undefined;
  let companyRef: string | undefined;
  if (deal.assignedToId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, deal.assignedToId));
    assignedToName = u?.name;
  }
  if (deal.companyId) {
    const [co] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, deal.companyId));
    companyRef = co?.name;
  }
  return { ...deal, assignedToName, companyRef };
}

router.get("/deals", async (req, res): Promise<void> => {
  let rows = await db.select().from(dealsTable).orderBy(sql`${dealsTable.createdAt} desc`);
  const { stage, companyId, assignedTo } = req.query;
  if (stage) rows = rows.filter(r => r.stage === stage);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (assignedTo) rows = rows.filter(r => r.assignedToId === parseInt(assignedTo as string, 10));
  res.json(await Promise.all(rows.map(enrichDeal)));
});

router.post("/deals", async (req, res): Promise<void> => {
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(dealsTable);
  const num = (count[0]?.count ?? 0) + 1;
  const dealNumber = `DEAL-${new Date().getFullYear()}-${String(num).padStart(4, "0")}`;
  const [deal] = await db.insert(dealsTable).values({ ...req.body, dealNumber }).returning();
  res.status(201).json(await enrichDeal(deal));
});

router.get("/deals/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, id));
  if (!deal) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichDeal(deal));
});

router.put("/deals/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [deal] = await db.update(dealsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(dealsTable.id, id)).returning();
  if (!deal) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichDeal(deal));
});

router.delete("/deals/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(dealsTable).where(eq(dealsTable.id, id));
  res.json({ success: true });
});

export default router;
