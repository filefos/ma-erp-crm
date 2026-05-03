import { Router } from "express";
import { db, quotationsTable, quotationItemsTable, companiesTable, usersTable, dealsTable, leadsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess, getOwnerScope, inOwnerScope, ownerScopeFilter } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

async function genQuotationNumber(companyId: number) {
  const [co] = await db.select({ prefix: companiesTable.prefix }).from(companiesTable).where(eq(companiesTable.id, companyId));
  const prefix = co?.prefix ?? "PM";
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(quotationsTable).where(eq(quotationsTable.companyId, companyId));
  const num = (count[0]?.count ?? 0) + 1;
  return `${prefix}-QTN-${new Date().getFullYear()}-${String(num).padStart(4, "0")}`;
}

async function enrichQuotation(q: typeof quotationsTable.$inferSelect) {
  const items = await db.select().from(quotationItemsTable).where(eq(quotationItemsTable.quotationId, q.id)).orderBy(quotationItemsTable.sortOrder);
  let companyRef: string | undefined;
  let preparedByName: string | undefined;
  let approvedByName: string | undefined;
  if (q.companyId) {
    const [co] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, q.companyId));
    companyRef = co?.name;
  }
  if (q.preparedById) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, q.preparedById));
    preparedByName = u?.name;
  }
  if (q.approvedById) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, q.approvedById));
    approvedByName = u?.name;
  }
  return { ...q, items, companyRef, preparedByName, approvedByName };
}

router.get("/quotations", requirePermission("quotations", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(quotationsTable).orderBy(sql`${quotationsTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const ownerScope = await getOwnerScope(req);
  rows = ownerScopeFilter(ownerScope, rows, ["preparedById", "approvedById"]);
  const { status, companyId, search } = req.query;
  if (status) rows = rows.filter(r => r.status === status);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (search) {
    const s = (search as string).toLowerCase();
    rows = rows.filter(r => r.quotationNumber.toLowerCase().includes(s) || r.clientName.toLowerCase().includes(s));
  }
  const enriched = await Promise.all(rows.map(enrichQuotation));
  res.json(enriched);
});

router.post("/quotations", requirePermission("quotations", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const quotationNumber = await genQuotationNumber(data.companyId);

  const items = data.items ?? [];
  let subtotal = 0;
  for (const item of items) {
    const amount = (item.quantity ?? 1) * (item.rate ?? 0) * (1 - (item.discount ?? 0) / 100);
    item.amount = amount;
    subtotal += amount;
  }
  const discount = data.discount ?? 0;
  const discountedSubtotal = subtotal * (1 - discount / 100);
  const vatPercent = data.vatPercent ?? 5;
  const vatAmount = discountedSubtotal * vatPercent / 100;
  const grandTotal = discountedSubtotal + vatAmount;

  const [quotation] = await db.insert(quotationsTable).values({
    quotationNumber, companyId: data.companyId, clientName: data.clientName,
    clientEmail: data.clientEmail, clientPhone: data.clientPhone,
    clientContactPerson: data.clientContactPerson, customerTrn: data.customerTrn,
    projectName: data.projectName, projectLocation: data.projectLocation,
    status: data.status ?? "draft", subtotal, discount, vatPercent, vatAmount, grandTotal,
    paymentTerms: data.paymentTerms, deliveryTerms: data.deliveryTerms,
    validity: data.validity, termsConditions: data.termsConditions,
    techSpecs: data.techSpecs, additionalItems: data.additionalItems,
    preparedById: req.user?.id, leadId: data.leadId, dealId: data.dealId,
  }).returning();

  if (items.length > 0) {
    await db.insert(quotationItemsTable).values(items.map((item: any, i: number) => ({
      quotationId: quotation.id, description: item.description, quantity: item.quantity ?? 1,
      unit: item.unit ?? "nos", rate: item.rate ?? 0, amount: item.amount ?? 0,
      discount: item.discount ?? 0, sortOrder: item.sortOrder ?? i,
    })));
  }

  res.status(201).json(await enrichQuotation(quotation));
});

router.get("/quotations/:id", requirePermission("quotations", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [q] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!q) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [q]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const ownerScope = await getOwnerScope(req);
  if (!ownerScopeFilter(ownerScope, [q], ["preparedById", "approvedById"]).length) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  res.json(await enrichQuotation(q));
});

router.put("/quotations/:id", requirePermission("quotations", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const data = req.body;
  const [existing] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const ownerScope = await getOwnerScope(req);
  if (!ownerScopeFilter(ownerScope, [existing], ["preparedById", "approvedById"]).length) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const items = data.items ?? [];
  let subtotal = 0;
  for (const item of items) {
    const amount = (item.quantity ?? 1) * (item.rate ?? 0) * (1 - (item.discount ?? 0) / 100);
    item.amount = amount;
    subtotal += amount;
  }
  const discount = data.discount ?? 0;
  const discountedSubtotal = subtotal * (1 - discount / 100);
  const vatPercent = data.vatPercent ?? 5;
  const vatAmount = discountedSubtotal * vatPercent / 100;
  const grandTotal = discountedSubtotal + vatAmount;

  const [q] = await db.update(quotationsTable).set({
    ...data, subtotal, vatAmount, grandTotal, items: undefined, updatedAt: new Date(),
  }).where(eq(quotationsTable.id, id)).returning();

  if (items.length > 0) {
    await db.delete(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
    await db.insert(quotationItemsTable).values(items.map((item: any, i: number) => ({
      quotationId: id, description: item.description, quantity: item.quantity ?? 1,
      unit: item.unit ?? "nos", rate: item.rate ?? 0, amount: item.amount ?? 0,
      discount: item.discount ?? 0, sortOrder: item.sortOrder ?? i,
    })));
  }

  res.json(await enrichQuotation(q));
});

router.delete("/quotations/:id", requirePermission("quotations", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (existing && !scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  if (existing) {
    const ownerScope = await getOwnerScope(req);
    if (!ownerScopeFilter(ownerScope, [existing], ["preparedById", "approvedById"]).length) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
  }
  await db.delete(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
  await db.delete(quotationsTable).where(eq(quotationsTable.id, id));
  res.json({ success: true });
});

router.post("/quotations/:id/approve", requirePermission("quotations", "approve"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const ownerScope = await getOwnerScope(req);
  if (!ownerScopeFilter(ownerScope, [existing], ["preparedById", "approvedById"]).length) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  // Map lead score → deal probability so generated/updated deals reflect lead quality.
  const scoreToProbability = (score: string | undefined): number => {
    switch ((score ?? "cold").toLowerCase()) {
      case "hot": return 70;
      case "warm": return 40;
      case "cold": return 20;
      default: return 30;
    }
  };

  // Approve + (auto-create or update existing deal) atomically.
  const result = await db.transaction(async (tx) => {
    const warnings: string[] = [];
    const [q] = await tx.update(quotationsTable).set({
      status: "approved", approvedById: req.user?.id, updatedAt: new Date(),
    }).where(eq(quotationsTable.id, id)).returning();

    // Read lead (if any) to derive assignment + probability mapping.
    let leadAssignedToId: number | null = null;
    let leadScore: string | undefined;
    if (q.leadId) {
      const [l] = await tx.select({ assignedToId: leadsTable.assignedToId, leadScore: leadsTable.leadScore })
        .from(leadsTable).where(eq(leadsTable.id, q.leadId));
      leadAssignedToId = l?.assignedToId ?? null;
      leadScore = l?.leadScore;
    }
    const targetProbability = scoreToProbability(leadScore);

    let dealId: number | undefined = q.dealId ?? undefined;
    let createdDeal = false;

    if (!dealId && q.leadId) {
      // Link to an OPEN deal for this lead (skip closed-won/closed-lost ones).
      const [linkedDeal] = await tx.select({ id: dealsTable.id })
        .from(dealsTable)
        .where(sql`${dealsTable.leadId} = ${q.leadId} AND ${dealsTable.stage} NOT IN ('won', 'lost')`)
        .orderBy(sql`${dealsTable.createdAt} desc`).limit(1);
      if (linkedDeal) dealId = linkedDeal.id;
    }

    if (dealId) {
      // Advance the existing open deal: bump value to the latest quote, raise
      // probability to the score-derived target, and ensure stage is at least "proposal".
      const [d] = await tx.select().from(dealsTable).where(eq(dealsTable.id, dealId));
      if (d) {
        const newValue = Math.max(Number(d.value ?? 0), Number(q.grandTotal ?? 0));
        const newProbability = Math.max(Number(d.probability ?? 0), targetProbability);
        const newStage = ["new", "qualified", "contacted"].includes(d.stage) ? "proposal" : d.stage;
        await tx.update(dealsTable).set({
          value: newValue,
          probability: newProbability,
          stage: newStage,
          updatedAt: new Date(),
          notes: d.notes
            ? `${d.notes}\nUpdated by approval of quotation ${q.quotationNumber}.`
            : `Updated by approval of quotation ${q.quotationNumber}.`,
        }).where(eq(dealsTable.id, dealId));
      }
    } else {
      if (!q.companyId) {
        warnings.push("Quotation has no company — deal not created.");
      } else {
        const count = await tx.select({ count: sql<number>`count(*)::int` }).from(dealsTable);
        const num = (count[0]?.count ?? 0) + 1;
        const dealNumber = `DEAL-${new Date().getFullYear()}-${String(num).padStart(4, "0")}`;
        const [newDeal] = await tx.insert(dealsTable).values({
          dealNumber,
          title: q.projectName ? `${q.clientName} — ${q.projectName}` : q.clientName,
          clientName: q.clientName,
          value: q.grandTotal ?? 0,
          stage: "proposal",
          probability: targetProbability,
          assignedToId: leadAssignedToId ?? req.user?.id ?? null,
          companyId: q.companyId,
          leadId: q.leadId ?? null,
          notes: `Auto-created from approved quotation ${q.quotationNumber}.`,
        }).returning();
        dealId = newDeal.id;
        createdDeal = true;
      }
    }

    if (dealId && q.dealId !== dealId) {
      await tx.update(quotationsTable).set({ dealId, updatedAt: new Date() })
        .where(eq(quotationsTable.id, q.id));
      q.dealId = dealId;
    }
    return { q, dealId, createdDeal, warnings };
  });

  const enriched = await enrichQuotation(result.q);
  res.json({
    ...enriched,
    dealId: result.dealId,
    createdDeal: result.createdDeal,
    warnings: result.warnings,
  });
});

export default router;
