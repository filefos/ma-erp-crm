import { Router } from "express";
import { db, leadsTable, usersTable } from "@workspace/db";
import { eq, like, and, or, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

async function enrichLead(lead: typeof leadsTable.$inferSelect) {
  let assignedToName: string | undefined;
  let companyRef: string | undefined;
  if (lead.assignedToId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, lead.assignedToId));
    assignedToName = u?.name;
  }
  return { ...lead, assignedToName, companyRef: lead.companyName };
}

router.get("/leads", async (req, res): Promise<void> => {
  let rows = await db.select().from(leadsTable).orderBy(sql`${leadsTable.createdAt} desc`);
  
  const { status, companyId, assignedTo, search, leadScore } = req.query;
  if (status) rows = rows.filter(r => r.status === status);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (assignedTo) rows = rows.filter(r => r.assignedToId === parseInt(assignedTo as string, 10));
  if (leadScore) rows = rows.filter(r => r.leadScore === leadScore);
  if (search) {
    const s = (search as string).toLowerCase();
    rows = rows.filter(r => r.leadName.toLowerCase().includes(s) || r.companyName?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s));
  }

  const enriched = await Promise.all(rows.map(enrichLead));
  res.json(enriched);
});

router.get("/leads/pipeline", async (req, res): Promise<void> => {
  let rows = await db.select().from(leadsTable).orderBy(sql`${leadsTable.createdAt} desc`);
  const { companyId } = req.query;
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  
  const enriched = await Promise.all(rows.map(enrichLead));
  const stages = ["new","contacted","qualified","site_visit","quotation_required","quotation_sent","negotiation","won","lost"];
  const pipeline: Record<string, typeof enriched> = {
    new: [], contacted: [], qualified: [], siteVisit: [], quotationRequired: [], quotationSent: [], negotiation: [], won: [], lost: []
  };
  const stageMap: Record<string, string> = {
    new: "new", contacted: "contacted", qualified: "qualified",
    site_visit: "siteVisit", quotation_required: "quotationRequired",
    quotation_sent: "quotationSent", negotiation: "negotiation", won: "won", lost: "lost"
  };
  for (const lead of enriched) {
    const key = stageMap[lead.status] ?? "new";
    pipeline[key].push(lead);
  }
  res.json(pipeline);
});

router.post("/leads", async (req, res): Promise<void> => {
  const data = req.body;
  // Generate lead number
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(leadsTable);
  const num = (count[0]?.count ?? 0) + 1;
  const year = new Date().getFullYear();
  const leadNumber = `LEAD-${year}-${String(num).padStart(4, "0")}`;

  const [lead] = await db.insert(leadsTable).values({
    leadNumber,
    leadName: data.leadName,
    companyName: data.companyName,
    contactPerson: data.contactPerson,
    phone: data.phone,
    whatsapp: data.whatsapp,
    email: data.email,
    location: data.location,
    source: data.source,
    requirementType: data.requirementType,
    quantity: data.quantity,
    budget: data.budget,
    status: data.status ?? "new",
    assignedToId: data.assignedToId,
    notes: data.notes,
    nextFollowUp: data.nextFollowUp,
    leadScore: data.leadScore ?? "cold",
    companyId: data.companyId,
  }).returning();
  res.status(201).json(await enrichLead(lead));
});

router.get("/leads/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!lead) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichLead(lead));
});

router.put("/leads/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const data = req.body;
  const [lead] = await db.update(leadsTable).set({ ...data, updatedAt: new Date() }).where(eq(leadsTable.id, id)).returning();
  if (!lead) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichLead(lead));
});

router.delete("/leads/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(leadsTable).where(eq(leadsTable.id, id));
  res.json({ success: true });
});

export default router;
