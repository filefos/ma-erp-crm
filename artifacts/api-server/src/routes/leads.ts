import { Router } from "express";
import { db, leadsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess, getOwnerScope, inOwnerScope, ownerScopeFilter } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

async function enrichLead(lead: typeof leadsTable.$inferSelect) {
  let assignedToName: string | undefined;
  if (lead.assignedToId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, lead.assignedToId));
    assignedToName = u?.name;
  }
  return { ...lead, assignedToName, companyRef: lead.companyName };
}

router.get("/leads", requirePermission("leads", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(leadsTable).orderBy(sql`${leadsTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const ownerScope = await getOwnerScope(req);
  rows = ownerScopeFilter(ownerScope, rows, ["assignedToId"]);
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

router.get("/leads/pipeline", requirePermission("leads", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(leadsTable).orderBy(sql`${leadsTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const ownerScope = await getOwnerScope(req);
  rows = ownerScopeFilter(ownerScope, rows, ["assignedToId"]);
  const { companyId } = req.query;
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  const enriched = await Promise.all(rows.map(enrichLead));
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

// Follow-up reminders check — creates notifications for due/overdue follow-ups
router.post("/leads/follow-up-check", requirePermission("leads", "view"), async (req, res): Promise<void> => {
  const me = req.user!;
  const today = new Date().toISOString().split("T")[0];

  let dueLeads = await db.select().from(leadsTable)
    .where(and(eq(leadsTable.isActive, true), sql`${leadsTable.nextFollowUp} IS NOT NULL AND ${leadsTable.nextFollowUp} <= ${today}`));
  dueLeads = scopeFilter(req, dueLeads);
  const ownerScope = await getOwnerScope(req);
  dueLeads = ownerScopeFilter(ownerScope, dueLeads, ["assignedToId"]);
  dueLeads = dueLeads.filter(l => !["won", "lost"].includes(l.status));

  let created = 0;
  for (const lead of dueLeads) {
    const notifyUsers: number[] = [];
    if (lead.assignedToId) notifyUsers.push(lead.assignedToId);
    if (!notifyUsers.includes(me.id)) notifyUsers.push(me.id);

    for (const uid of notifyUsers) {
      // Check if notification already created today for this lead+user
      const [existing] = await db.select({ count: sql<number>`count(*)::int` })
        .from(notificationsTable)
        .where(and(
          eq(notificationsTable.userId, uid),
          eq(notificationsTable.entityType, "lead"),
          eq(notificationsTable.entityId, lead.id),
          sql`DATE(${notificationsTable.createdAt}) = CURRENT_DATE`,
        ));
      if ((existing?.count ?? 0) === 0) {
        const isOverdue = lead.nextFollowUp! < today;
        await db.insert(notificationsTable).values({
          title: isOverdue ? "Overdue Follow-up!" : "Follow-up Due Today",
          message: `${isOverdue ? "OVERDUE: " : ""}Follow-up required for lead "${lead.leadName}" (${lead.companyName ?? "Unknown"}) — ${lead.requirementType ?? lead.status}`,
          type: isOverdue ? "warning" : "info",
          userId: uid,
          entityType: "lead",
          entityId: lead.id,
          isRead: false,
        });
        created++;
      }
    }
  }

  res.json({ dueCount: dueLeads.length, notificationsCreated: created });
});

router.post("/leads", requirePermission("leads", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
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

router.get("/leads/:id", requirePermission("leads", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!lead) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [lead]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const ownerScope = await getOwnerScope(req);
  if (!inOwnerScope(ownerScope, lead.assignedToId)) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(await enrichLead(lead));
});

router.put("/leads/:id", requirePermission("leads", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const ownerScope = await getOwnerScope(req);
  if (!inOwnerScope(ownerScope, existing.assignedToId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const [lead] = await db.update(leadsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(leadsTable.id, id)).returning();
  res.json(await enrichLead(lead));
});

router.delete("/leads/:id", requirePermission("leads", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (existing && !scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  if (existing) {
    const ownerScope = await getOwnerScope(req);
    if (!inOwnerScope(ownerScope, existing.assignedToId)) { res.status(403).json({ error: "Forbidden" }); return; }
  }
  await db.delete(leadsTable).where(eq(leadsTable.id, id));
  res.json({ success: true });
});

export default router;
