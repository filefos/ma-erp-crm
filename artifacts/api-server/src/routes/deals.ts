import { Router } from "express";
import { db, dealsTable, usersTable, companiesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess, getOwnerScope, inOwnerScope, ownerScopeFilter } from "../middlewares/auth";

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

router.get("/deals", requirePermission("deals", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(dealsTable).orderBy(sql`${dealsTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const ownerScope = await getOwnerScope(req);
  rows = ownerScopeFilter(ownerScope, rows, ["assignedToId"]);
  const { stage, companyId, assignedTo } = req.query;
  if (stage) rows = rows.filter(r => r.stage === stage);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (assignedTo) rows = rows.filter(r => r.assignedToId === parseInt(assignedTo as string, 10));
  res.json(await Promise.all(rows.map(enrichDeal)));
});

router.post("/deals", requirePermission("deals", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(dealsTable);
  const num = (count[0]?.count ?? 0) + 1;
  const dealNumber = `DEAL-${new Date().getFullYear()}-${String(num).padStart(4, "0")}`;
  const [deal] = await db.insert(dealsTable).values({ ...req.body, dealNumber }).returning();
  res.status(201).json(await enrichDeal(deal));
});

router.get("/deals/:id", requirePermission("deals", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, id));
  if (!deal) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [deal]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const ownerScope = await getOwnerScope(req);
  if (!inOwnerScope(ownerScope, deal.assignedToId)) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(await enrichDeal(deal));
});

router.put("/deals/:id", requirePermission("deals", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(dealsTable).where(eq(dealsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const ownerScope = await getOwnerScope(req);
  if (!inOwnerScope(ownerScope, existing.assignedToId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const [deal] = await db.update(dealsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(dealsTable.id, id)).returning();
  res.json(await enrichDeal(deal));
});

router.delete("/deals/:id", requirePermission("deals", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(dealsTable).where(eq(dealsTable.id, id));
  if (existing && !scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  if (existing) {
    const ownerScope = await getOwnerScope(req);
    if (!inOwnerScope(ownerScope, existing.assignedToId)) { res.status(403).json({ error: "Forbidden" }); return; }
  }
  await db.delete(dealsTable).where(eq(dealsTable.id, id));
  res.json({ success: true });
});

export default router;
