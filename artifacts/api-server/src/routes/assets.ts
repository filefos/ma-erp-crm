import { Router } from "express";
import { db, assetsTable, companiesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/assets", requirePermission("assets", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(assetsTable).orderBy(assetsTable.name);
  rows = scopeFilter(req, rows);
  const { category, companyId, search } = req.query;
  if (category) rows = rows.filter(r => r.category === category);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (search) {
    const s = (search as string).toLowerCase();
    rows = rows.filter(r => r.name.toLowerCase().includes(s) || r.assetId.toLowerCase().includes(s));
  }
  const enriched = await Promise.all(rows.map(async (a) => {
    const [co] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, a.companyId));
    return { ...a, companyRef: co?.name };
  }));
  res.json(enriched);
});

router.post("/assets", requirePermission("assets", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const [co] = data.companyId ? await db.select({ prefix: companiesTable.prefix }).from(companiesTable).where(eq(companiesTable.id, data.companyId)) : [{ prefix: "PM" }];
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(assetsTable);
  const num = (count[0]?.count ?? 0) + 1;
  const assetId = `${co?.prefix ?? "PM"}-ASSET-${String(num).padStart(4, "0")}`;
  const [asset] = await db.insert(assetsTable).values({ ...data, assetId }).returning();
  res.status(201).json(asset);
});

router.get("/assets/:id", requirePermission("assets", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, id));
  if (!asset) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [asset]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(asset);
});

router.put("/assets/:id", requirePermission("assets", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(assetsTable).where(eq(assetsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [asset] = await db.update(assetsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(assetsTable.id, id)).returning();
  res.json(asset);
});

export default router;
