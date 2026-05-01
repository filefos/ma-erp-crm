import { Router } from "express";
import { db, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/companies", async (_req, res): Promise<void> => {
  const companies = await db.select().from(companiesTable).orderBy(companiesTable.id);
  res.json(companies);
});

router.post("/companies", async (req, res): Promise<void> => {
  const data = req.body;
  const [co] = await db.insert(companiesTable).values({
    name: data.name,
    shortName: data.shortName,
    prefix: data.prefix,
    address: data.address,
    phone: data.phone,
    email: data.email,
    website: data.website,
    trn: data.trn,
    vatPercent: data.vatPercent ?? 5,
    logo: data.logo,
    bankDetails: data.bankDetails,
    letterhead: data.letterhead,
  }).returning();
  res.status(201).json(co);
});

router.get("/companies/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!co) { res.status(404).json({ error: "Not found" }); return; }
  res.json(co);
});

router.put("/companies/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const data = req.body;
  const [co] = await db.update(companiesTable).set({ ...data, updatedAt: new Date() }).where(eq(companiesTable.id, id)).returning();
  if (!co) { res.status(404).json({ error: "Not found" }); return; }
  res.json(co);
});

export default router;
