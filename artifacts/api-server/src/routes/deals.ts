import { Router } from "express";
import {
  db, dealsTable, usersTable, companiesTable,
  quotationsTable, quotationItemsTable, leadsTable,
  proformaInvoicesTable, taxInvoicesTable, deliveryNotesTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess, getOwnerScope, inOwnerScope, ownerScopeFilter } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

// Tx-aware sequential document number, mirroring the genDocNumber helper in
// routes/invoices.ts. Kept inline so the count + insert run in the same tx.
async function genDocNum(tx: any, companyId: number, type: string, table: any) {
  const [co] = await tx.select({ prefix: companiesTable.prefix }).from(companiesTable).where(eq(companiesTable.id, companyId));
  const prefix = co?.prefix ?? "PM";
  const count = await tx.select({ count: sql<number>`count(*)::int` }).from(table);
  const num = (count[0]?.count ?? 0) + 1;
  return `${prefix}-${type}-${new Date().getFullYear()}-${String(num).padStart(4, "0")}`;
}

export type ClosingDocsResult = {
  // Always-present linkage IDs (whether the row was just created or already existed).
  proformaInvoiceId?: number;
  taxInvoiceId?: number;
  deliveryNoteId?: number;
  // Flags identifying which rows this call newly created (for UI toasts / audit).
  createdProformaInvoice: boolean;
  createdTaxInvoice: boolean;
  createdDeliveryNote: boolean;
  warnings: string[];
};

// Auto-create downstream documents (PI + Tax Invoice + Delivery Note) when a deal closes won.
// Idempotent: each document is only created if not already present for the source quotation,
// and the existing IDs are returned regardless so callers can always link to them.
async function autoCreateClosingDocs(
  tx: any,
  deal: typeof dealsTable.$inferSelect,
  preparedById: number | undefined,
): Promise<ClosingDocsResult> {
  {
    const result: ClosingDocsResult = {
      createdProformaInvoice: false,
      createdTaxInvoice: false,
      createdDeliveryNote: false,
      warnings: [],
    };

    const [q] = await tx.select().from(quotationsTable)
      .where(eq(quotationsTable.dealId, deal.id))
      .orderBy(sql`${quotationsTable.createdAt} desc`).limit(1);
    if (!q) {
      result.warnings.push("No quotation linked to this deal — closing documents not created.");
      return result;
    }
    if (!q.companyId) {
      result.warnings.push("Quotation has no company — closing documents not created.");
      return result;
    }
    const items: (typeof quotationItemsTable.$inferSelect)[] = await tx.select().from(quotationItemsTable)
      .where(eq(quotationItemsTable.quotationId, q.id)).orderBy(quotationItemsTable.sortOrder);
    if (items.length === 0) {
      result.warnings.push("Quotation has no items — closing documents may be empty.");
    }

    const [co] = await tx.select({ trn: companiesTable.trn })
      .from(companiesTable).where(eq(companiesTable.id, q.companyId));
    const today = new Date().toISOString().split("T")[0];
    // Traceability suffix written into notes/items so docs always reference back to deal+lead.
    const traceTag = `[deal:${deal.id}${deal.leadId ? ` lead:${deal.leadId}` : ""}]`;

    // -- Proforma Invoice (idempotent on quotationId) --
    const [existingPi] = await tx.select({ id: proformaInvoicesTable.id })
      .from(proformaInvoicesTable).where(eq(proformaInvoicesTable.quotationId, q.id)).limit(1);
    if (existingPi) {
      result.proformaInvoiceId = existingPi.id;
    } else {
      const piNumber = await genDocNum(tx, q.companyId, "PI", proformaInvoicesTable);
      const [pi] = await tx.insert(proformaInvoicesTable).values({
        piNumber, companyId: q.companyId, clientName: q.clientName,
        clientEmail: q.clientEmail, clientPhone: q.clientPhone,
        projectName: q.projectName, projectLocation: q.projectLocation,
        quotationId: q.id, subtotal: q.subtotal ?? 0, vatPercent: q.vatPercent ?? 5,
        vatAmount: q.vatAmount ?? 0, total: q.grandTotal ?? 0,
        paymentTerms: q.paymentTerms, status: "draft", preparedById: preparedById ?? undefined,
        notes: `Auto-created from quotation ${q.quotationNumber} on deal ${deal.dealNumber}. ${traceTag}`,
        items: JSON.stringify(items.map(i => ({
          description: i.description, quantity: i.quantity, unit: i.unit, rate: i.rate, amount: i.amount,
        }))),
      }).returning();
      result.proformaInvoiceId = pi.id;
      result.createdProformaInvoice = true;
    }

    // -- Tax Invoice (idempotent on quotationId) --
    const [existingTax] = await tx.select({ id: taxInvoicesTable.id })
      .from(taxInvoicesTable).where(eq(taxInvoicesTable.quotationId, q.id)).limit(1);
    if (existingTax) {
      result.taxInvoiceId = existingTax.id;
    } else {
      const invoiceNumber = await genDocNum(tx, q.companyId, "INV", taxInvoicesTable);
      const grandTotal = q.grandTotal ?? 0;
      const [taxInv] = await tx.insert(taxInvoicesTable).values({
        invoiceNumber, companyId: q.companyId, companyTrn: co?.trn ?? null,
        clientName: q.clientName, clientTrn: q.customerTrn,
        invoiceDate: today, supplyDate: today,
        quotationId: q.id, subtotal: q.subtotal ?? 0, vatPercent: q.vatPercent ?? 5,
        vatAmount: q.vatAmount ?? 0, grandTotal, amountPaid: 0, balance: grandTotal,
        paymentStatus: "unpaid", status: "active",
      }).returning();
      result.taxInvoiceId = taxInv.id;
      result.createdTaxInvoice = true;
    }

    // -- Delivery Note (idempotent on taxInvoiceId) --
    if (result.taxInvoiceId) {
      const [existingDn] = await tx.select({ id: deliveryNotesTable.id })
        .from(deliveryNotesTable).where(eq(deliveryNotesTable.taxInvoiceId, result.taxInvoiceId)).limit(1);
      if (existingDn) {
        result.deliveryNoteId = existingDn.id;
      } else {
        const dnNumber = await genDocNum(tx, q.companyId, "DN", deliveryNotesTable);
        const [dn] = await tx.insert(deliveryNotesTable).values({
          dnNumber, companyId: q.companyId, clientName: q.clientName,
          projectName: q.projectName ? `${q.projectName} ${traceTag}` : traceTag,
          deliveryLocation: q.projectLocation,
          deliveryDate: today, status: "pending", taxInvoiceId: result.taxInvoiceId,
          items: JSON.stringify(items.map(i => ({
            description: i.description, quantity: i.quantity, unit: i.unit,
          }))),
        }).returning();
        result.deliveryNoteId = dn.id;
        result.createdDeliveryNote = true;
      }
    }

    return result;
  }
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
  // Single atomic transaction for the deal update. The downstream
  // auto-creation runs inside a savepoint and on failure rolls back only
  // that block, surfacing the error as a soft warning while the stage
  // transition still commits — never blocking the user with a 500.
  const { deal, auto } = await db.transaction(async (tx) => {
    const [deal] = await tx.update(dealsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(dealsTable.id, id)).returning();
    let auto: ClosingDocsResult = {
      createdProformaInvoice: false, createdTaxInvoice: false, createdDeliveryNote: false, warnings: [],
    };
    // Note: this codebase consistently uses the literal "won" (see lead status,
    // notifications, dashboard, jobs/follow-ups). There is no separate "closed_won".
    if (existing.stage !== "won" && deal.stage === "won") {
      try {
        auto = await tx.transaction(async (sp: any) => autoCreateClosingDocs(sp, deal, req.user?.id));
      } catch (err: any) {
        req.log?.error({ err, dealId: deal.id }, "Auto-closing-doc creation failed");
        auto = {
          createdProformaInvoice: false, createdTaxInvoice: false, createdDeliveryNote: false,
          warnings: [`Closing documents could not be auto-created (${err?.message ?? "unknown error"}). You can create them manually from Accounts.`],
        };
      }
    }
    return { deal, auto };
  });
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
