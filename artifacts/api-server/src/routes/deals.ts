import { Router } from "express";
import {
  db, dealsTable, usersTable, companiesTable,
  quotationsTable, quotationItemsTable,
  proformaInvoicesTable, taxInvoicesTable, deliveryNotesTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess, getOwnerScope, inOwnerScope, ownerScopeFilter } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

// Auto-create downstream documents (PI + Tax Invoice + Delivery Note) when a deal closes won.
// Idempotent: each document is only created if not already present for the source quotation.
async function autoCreateClosingDocs(
  deal: typeof dealsTable.$inferSelect,
  preparedById: number | undefined,
): Promise<{
  generatedProformaInvoiceId?: number;
  generatedTaxInvoiceId?: number;
  generatedDeliveryNoteId?: number;
  warnings: string[];
}> {
  return await db.transaction(async (tx) => {
    const warnings: string[] = [];
    const result: {
      generatedProformaInvoiceId?: number;
      generatedTaxInvoiceId?: number;
      generatedDeliveryNoteId?: number;
      warnings: string[];
    } = { warnings };

    const [q] = await tx.select().from(quotationsTable)
      .where(eq(quotationsTable.dealId, deal.id))
      .orderBy(sql`${quotationsTable.createdAt} desc`).limit(1);
    if (!q) {
      warnings.push("No quotation linked to this deal — closing documents not created.");
      return result;
    }
    if (!q.companyId) {
      warnings.push("Quotation has no company — closing documents not created.");
      return result;
    }
    const items = await tx.select().from(quotationItemsTable)
      .where(eq(quotationItemsTable.quotationId, q.id)).orderBy(quotationItemsTable.sortOrder);
    if (items.length === 0) {
      warnings.push("Quotation has no items — closing documents may be empty.");
    }

    const [co] = await tx.select({ prefix: companiesTable.prefix, trn: companiesTable.trn })
      .from(companiesTable).where(eq(companiesTable.id, q.companyId));
    const prefix = co?.prefix ?? "PM";
    const year = new Date().getFullYear();
    const today = new Date().toISOString().split("T")[0];

    // Proforma Invoice (idempotent on quotationId)
    const [existingPi] = await tx.select({ id: proformaInvoicesTable.id })
      .from(proformaInvoicesTable).where(eq(proformaInvoicesTable.quotationId, q.id)).limit(1);
    if (!existingPi) {
      const piCount = await tx.select({ count: sql<number>`count(*)::int` }).from(proformaInvoicesTable);
      const piNum = (piCount[0]?.count ?? 0) + 1;
      const piNumber = `${prefix}-PI-${year}-${String(piNum).padStart(4, "0")}`;
      const [pi] = await tx.insert(proformaInvoicesTable).values({
        piNumber, companyId: q.companyId, clientName: q.clientName,
        clientEmail: q.clientEmail, clientPhone: q.clientPhone,
        projectName: q.projectName, projectLocation: q.projectLocation,
        quotationId: q.id, subtotal: q.subtotal ?? 0, vatPercent: q.vatPercent ?? 5,
        vatAmount: q.vatAmount ?? 0, total: q.grandTotal ?? 0,
        paymentTerms: q.paymentTerms, status: "draft", preparedById: preparedById ?? undefined,
        items: JSON.stringify(items.map(i => ({
          description: i.description, quantity: i.quantity, unit: i.unit, rate: i.rate, amount: i.amount,
        }))),
      }).returning();
      result.generatedProformaInvoiceId = pi.id;
    }

    // Tax Invoice (idempotent on quotationId)
    let taxInvoiceId: number | undefined;
    const [existingTax] = await tx.select({ id: taxInvoicesTable.id })
      .from(taxInvoicesTable).where(eq(taxInvoicesTable.quotationId, q.id)).limit(1);
    if (existingTax) {
      taxInvoiceId = existingTax.id;
    } else {
      const txCount = await tx.select({ count: sql<number>`count(*)::int` }).from(taxInvoicesTable);
      const txNum = (txCount[0]?.count ?? 0) + 1;
      const invoiceNumber = `${prefix}-INV-${year}-${String(txNum).padStart(4, "0")}`;
      const grandTotal = q.grandTotal ?? 0;
      const [taxInv] = await tx.insert(taxInvoicesTable).values({
        invoiceNumber, companyId: q.companyId, companyTrn: co?.trn ?? null,
        clientName: q.clientName, clientTrn: q.customerTrn,
        invoiceDate: today, supplyDate: today,
        quotationId: q.id, subtotal: q.subtotal ?? 0, vatPercent: q.vatPercent ?? 5,
        vatAmount: q.vatAmount ?? 0, grandTotal, amountPaid: 0, balance: grandTotal,
        paymentStatus: "unpaid", status: "active",
      }).returning();
      taxInvoiceId = taxInv.id;
      result.generatedTaxInvoiceId = taxInv.id;
    }

    // Delivery Note (idempotent on taxInvoiceId)
    if (taxInvoiceId) {
      const [existingDn] = await tx.select({ id: deliveryNotesTable.id })
        .from(deliveryNotesTable).where(eq(deliveryNotesTable.taxInvoiceId, taxInvoiceId)).limit(1);
      if (!existingDn) {
        const dnCount = await tx.select({ count: sql<number>`count(*)::int` }).from(deliveryNotesTable);
        const dnNum = (dnCount[0]?.count ?? 0) + 1;
        const dnNumber = `${prefix}-DN-${year}-${String(dnNum).padStart(4, "0")}`;
        const [dn] = await tx.insert(deliveryNotesTable).values({
          dnNumber, companyId: q.companyId, clientName: q.clientName,
          projectName: q.projectName, deliveryLocation: q.projectLocation,
          deliveryDate: today, status: "pending", taxInvoiceId,
          items: JSON.stringify(items.map(i => ({
            description: i.description, quantity: i.quantity, unit: i.unit,
          }))),
        }).returning();
        result.generatedDeliveryNoteId = dn.id;
      }
    }

    return result;
  });
}

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
  // Auto-create downstream documents when stage transitions to "won".
  let auto: {
    generatedProformaInvoiceId?: number;
    generatedTaxInvoiceId?: number;
    generatedDeliveryNoteId?: number;
    warnings: string[];
  } = { warnings: [] };
  if (existing.stage !== "won" && deal.stage === "won") {
    auto = await autoCreateClosingDocs(deal, req.user?.id);
  }
  const enriched = await enrichDeal(deal);
  res.json({ ...enriched, ...auto });
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
