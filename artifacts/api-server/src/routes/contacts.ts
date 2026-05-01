import { Router } from "express";
import { db, contactsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/contacts", async (req, res): Promise<void> => {
  let rows = await db.select().from(contactsTable).orderBy(contactsTable.name);
  const { search, companyId } = req.query;
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (search) {
    const s = (search as string).toLowerCase();
    rows = rows.filter(r => r.name.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s) || r.companyName?.toLowerCase().includes(s));
  }
  res.json(rows);
});

router.post("/contacts", async (req, res): Promise<void> => {
  const [contact] = await db.insert(contactsTable).values(req.body).returning();
  res.status(201).json(contact);
});

router.get("/contacts/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
  if (!contact) { res.status(404).json({ error: "Not found" }); return; }
  res.json(contact);
});

router.put("/contacts/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [contact] = await db.update(contactsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(contactsTable.id, id)).returning();
  if (!contact) { res.status(404).json({ error: "Not found" }); return; }
  res.json(contact);
});

router.delete("/contacts/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(contactsTable).where(eq(contactsTable.id, id));
  res.json({ success: true });
});

export default router;
