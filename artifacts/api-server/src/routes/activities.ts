import { Router } from "express";
import { db, activitiesTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/activities", async (req, res): Promise<void> => {
  let rows = await db.select().from(activitiesTable).orderBy(sql`${activitiesTable.createdAt} desc`);
  const { leadId, dealId, contactId, type } = req.query;
  if (leadId) rows = rows.filter(r => r.leadId === parseInt(leadId as string, 10));
  if (dealId) rows = rows.filter(r => r.dealId === parseInt(dealId as string, 10));
  if (contactId) rows = rows.filter(r => r.contactId === parseInt(contactId as string, 10));
  if (type) rows = rows.filter(r => r.type === type);

  const enriched = await Promise.all(rows.map(async (a) => {
    let createdByName: string | undefined;
    if (a.createdById) {
      const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, a.createdById));
      createdByName = u?.name;
    }
    return { ...a, createdByName };
  }));
  res.json(enriched);
});

router.post("/activities", async (req, res): Promise<void> => {
  const [activity] = await db.insert(activitiesTable).values({
    ...req.body,
    createdById: req.user?.id,
  }).returning();
  res.status(201).json(activity);
});

router.put("/activities/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [activity] = await db.update(activitiesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(activitiesTable.id, id)).returning();
  if (!activity) { res.status(404).json({ error: "Not found" }); return; }
  res.json(activity);
});

router.delete("/activities/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(activitiesTable).where(eq(activitiesTable.id, id));
  res.json({ success: true });
});

export default router;
