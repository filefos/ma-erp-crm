import { Router } from "express";
import { db, leadsTable, usersTable, notificationsTable, quotationsTable, quotationItemsTable, companiesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess, getOwnerScope, inOwnerScope, ownerScopeFilter } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

// Auto-create a draft quotation from a lead when its status flips to "won".
// Idempotent: if any quotation already exists for this lead, return that one.
// Wrapped in a transaction so the read-modify-write is atomic.
// Returns the linked quotation id (always — whether newly created or pre-existing)
// plus a `created` flag and warnings for any soft issues.
async function autoCreateQuotationForLead(
  lead: typeof leadsTable.$inferSelect,
  preparedById: number | undefined,
): Promise<{ quotationId?: number; createdQuotation: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  if (!lead.companyId) {
    warnings.push("Lead has no company assigned — quotation not created.");
    return { createdQuotation: false, warnings };
  }
  return await db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: quotationsTable.id })
      .from(quotationsTable).where(eq(quotationsTable.leadId, lead.id)).limit(1);
    if (existing) return { quotationId: existing.id, createdQuotation: false, warnings };

    const [co] = await tx.select({ prefix: companiesTable.prefix })
      .from(companiesTable).where(eq(companiesTable.id, lead.companyId!));
    const prefix = co?.prefix ?? "PM";
    const count = await tx.select({ count: sql<number>`count(*)::int` })
      .from(quotationsTable).where(eq(quotationsTable.companyId, lead.companyId!));
    const num = (count[0]?.count ?? 0) + 1;
    const quotationNumber = `${prefix}-QTN-${new Date().getFullYear()}-${String(num).padStart(4, "0")}`;

    // Seed a placeholder line item so downstream PI/INV/DN are never empty.
    // If the lead has quantity + budget, derive a rate; otherwise leave at 0
    // so the user can edit before sending.
    const qty = lead.quantity && lead.quantity > 0 ? lead.quantity : 1;
    const rate = lead.budget && qty > 0 ? lead.budget / qty : 0;
    const amount = qty * rate;
    const subtotal = amount;
    const vatPercent = 5;
    const vatAmount = +(subtotal * vatPercent / 100).toFixed(2);
    const grandTotal = subtotal + vatAmount;

    const clientName = lead.companyName || lead.leadName || "Unknown Client";
    const [q] = await tx.insert(quotationsTable).values({
      quotationNumber,
      companyId: lead.companyId!,
      clientName,
      clientEmail: lead.email ?? undefined,
      clientPhone: lead.phone ?? undefined,
      clientContactPerson: lead.contactPerson ?? undefined,
      projectLocation: lead.location ?? undefined,
      projectName: lead.requirementType ?? undefined,
      status: "draft",
      leadId: lead.id,
      preparedById: preparedById ?? undefined,
      subtotal, vatPercent, vatAmount, grandTotal,
    }).returning();

    await tx.insert(quotationItemsTable).values({
      quotationId: q.id,
      description: lead.requirementType
        ? `${lead.requirementType} (TBD — please refine)`
        : `Prefab requirement for ${clientName} (TBD — please refine)`,
      quantity: qty,
      unit: "nos",
      rate,
      amount,
      sortOrder: 0,
    });

    if (!lead.email && !lead.phone) {
      warnings.push("Lead has no email or phone — quotation client contact details may be incomplete.");
    }
    if (!lead.requirementType || !lead.budget || !lead.quantity) {
      warnings.push("Quotation seeded with a placeholder line item — please review before sending.");
    }
    return { quotationId: q.id, createdQuotation: true, warnings };
  });
}

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
  // Auto-create draft quotation when lead status transitions to "won".
  let auto: { quotationId?: number; createdQuotation: boolean; warnings: string[] } =
    { createdQuotation: false, warnings: [] };
  if (existing.status !== "won" && lead.status === "won") {
    auto = await autoCreateQuotationForLead(lead, req.user?.id);
  }
  const enriched = await enrichLead(lead);
  res.json({ ...enriched, ...auto });
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
