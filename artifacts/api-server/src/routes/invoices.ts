import { Router } from "express";
import { db, proformaInvoicesTable, taxInvoicesTable, deliveryNotesTable, lposTable, companiesTable, quotationsTable } from "@workspace/db";
import { eq, sql, inArray } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess, getOwnerScope, inOwnerScope, ownerScopeFilter } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

async function genDocNumber(companyId: number, type: string, table: any) {
  const [co] = await db.select({ prefix: companiesTable.prefix }).from(companiesTable).where(eq(companiesTable.id, companyId));
  const prefix = co?.prefix ?? "PM";
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(table);
  const num = (count[0]?.count ?? 0) + 1;
  const year = new Date().getFullYear();
  return `${prefix}-${type}-${year}-${String(num).padStart(4, "0")}`;
}

function parsePiItems(pi: typeof proformaInvoicesTable.$inferSelect) {
  let items = [];
  try { items = JSON.parse((pi as any).items ?? "[]"); } catch {}
  return { ...pi, items };
}

// Proforma Invoices
router.get("/proforma-invoices", requirePermission("proforma_invoices", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(proformaInvoicesTable).orderBy(sql`${proformaInvoicesTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const ownerScope = await getOwnerScope(req);
  rows = ownerScopeFilter(ownerScope, rows, ["preparedById"]);
  const { status, companyId } = req.query;
  if (status) rows = rows.filter(r => r.status === status);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  const enriched = await Promise.all(rows.map(async (pi) => {
    const [co] = pi.companyId ? await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, pi.companyId)) : [undefined];
    return { ...parsePiItems(pi), companyRef: co?.name };
  }));
  res.json(enriched);
});

router.post("/proforma-invoices", requirePermission("proforma_invoices", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const piNumber = await genDocNumber(data.companyId, "PI", proformaInvoicesTable);
  const itemsStr = JSON.stringify(data.items ?? []);
  const { items: _items, ...rest } = data;
  const [pi] = await db.insert(proformaInvoicesTable).values({
    ...rest, piNumber, preparedById: req.user?.id, items: itemsStr,
  }).returning();
  res.status(201).json(parsePiItems(pi));
});

router.get("/proforma-invoices/:id", requirePermission("proforma_invoices", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [pi] = await db.select().from(proformaInvoicesTable).where(eq(proformaInvoicesTable.id, id));
  if (!pi) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [pi]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const ownerScope = await getOwnerScope(req);
  if (!inOwnerScope(ownerScope, pi.preparedById)) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(parsePiItems(pi));
});

router.delete("/proforma-invoices/:id", requirePermission("proforma_invoices", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(proformaInvoicesTable).where(eq(proformaInvoicesTable.id, id));
  if (existing && !scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  if (existing) {
    const ownerScope = await getOwnerScope(req);
    if (!inOwnerScope(ownerScope, existing.preparedById)) { res.status(403).json({ error: "Forbidden" }); return; }
  }
  await db.delete(proformaInvoicesTable).where(eq(proformaInvoicesTable.id, id));
  res.json({ success: true });
});

router.put("/proforma-invoices/:id", requirePermission("proforma_invoices", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(proformaInvoicesTable).where(eq(proformaInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const ownerScope = await getOwnerScope(req);
  if (!inOwnerScope(ownerScope, existing.preparedById)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { items: _items, ...rest } = req.body;
  const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (_items !== undefined) updateData.items = JSON.stringify(_items);
  const [pi] = await db.update(proformaInvoicesTable).set(updateData).where(eq(proformaInvoicesTable.id, id)).returning();
  res.json(parsePiItems(pi));
});

// Tax Invoices
router.get("/tax-invoices", requirePermission("tax_invoices", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(taxInvoicesTable).orderBy(sql`${taxInvoicesTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const { status, companyId, search } = req.query;
  if (status) rows = rows.filter(r => r.status === status);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (search) {
    const s = (search as string).toLowerCase();
    rows = rows.filter(r => r.invoiceNumber.toLowerCase().includes(s) || r.clientName.toLowerCase().includes(s));
  }
  const enriched = await Promise.all(rows.map(async (inv) => {
    const [co] = inv.companyId ? await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, inv.companyId)) : [undefined];
    return { ...inv, companyRef: co?.name };
  }));
  res.json(enriched);
});

router.post("/tax-invoices", requirePermission("tax_invoices", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const invoiceNumber = await genDocNumber(data.companyId, "INV", taxInvoicesTable);
  const balance = (data.grandTotal ?? 0) - (data.amountPaid ?? 0);
  const [inv] = await db.insert(taxInvoicesTable).values({ ...data, invoiceNumber, balance }).returning();
  res.status(201).json(inv);
});

router.get("/tax-invoices/:id", requirePermission("tax_invoices", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [inv] = await db.select().from(taxInvoicesTable).where(eq(taxInvoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [inv]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(inv);
});

router.put("/tax-invoices/:id", requirePermission("tax_invoices", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(taxInvoicesTable).where(eq(taxInvoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const data = req.body;
  if (data.amountPaid !== undefined && data.grandTotal !== undefined) {
    data.balance = data.grandTotal - data.amountPaid;
    data.paymentStatus = data.balance <= 0 ? "paid" : data.amountPaid > 0 ? "partial" : "unpaid";
  }
  const [inv] = await db.update(taxInvoicesTable).set({ ...data, updatedAt: new Date() }).where(eq(taxInvoicesTable.id, id)).returning();
  res.json(inv);
});

// Delivery Notes
router.get("/delivery-notes", requirePermission("delivery_notes", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(deliveryNotesTable).orderBy(sql`${deliveryNotesTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const { status, companyId } = req.query;
  if (status) rows = rows.filter(r => r.status === status);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  const enriched = rows.map(dn => {
    let items = [];
    try { items = JSON.parse(dn.items ?? "[]"); } catch {}
    return { ...dn, items };
  });
  res.json(enriched);
});

router.post("/delivery-notes", requirePermission("delivery_notes", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const dnNumber = await genDocNumber(data.companyId, "DN", deliveryNotesTable);
  const [dn] = await db.insert(deliveryNotesTable).values({
    ...data, dnNumber, items: JSON.stringify(data.items ?? []),
  }).returning();
  res.status(201).json({ ...dn, items: data.items ?? [] });
});

router.get("/delivery-notes/:id", requirePermission("delivery_notes", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [dn] = await db.select().from(deliveryNotesTable).where(eq(deliveryNotesTable.id, id));
  if (!dn) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [dn]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  let items = [];
  try { items = JSON.parse(dn.items ?? "[]"); } catch {}
  res.json({ ...dn, items });
});

router.put("/delivery-notes/:id", requirePermission("delivery_notes", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(deliveryNotesTable).where(eq(deliveryNotesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const data = req.body;
  const [dn] = await db.update(deliveryNotesTable).set({
    ...data, items: data.items ? JSON.stringify(data.items) : undefined, updatedAt: new Date(),
  }).where(eq(deliveryNotesTable.id, id)).returning();
  let items = [];
  try { items = JSON.parse(dn.items ?? "[]"); } catch {}
  res.json({ ...dn, items });
});

// LPOs — ownership scoping flows through the linked quotation's preparedById/approvedById.
async function lpoOwnerIds(lpo: { quotationId: number | null }): Promise<{ preparedById: number | null; approvedById: number | null }> {
  if (lpo.quotationId == null) return { preparedById: null, approvedById: null };
  const [q] = await db
    .select({ preparedById: quotationsTable.preparedById, approvedById: quotationsTable.approvedById })
    .from(quotationsTable)
    .where(eq(quotationsTable.id, lpo.quotationId));
  return { preparedById: q?.preparedById ?? null, approvedById: q?.approvedById ?? null };
}

router.get("/lpos", requirePermission("lpos", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(lposTable).orderBy(sql`${lposTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const ownerScope = await getOwnerScope(req);
  if (ownerScope.kind !== "all") {
    // Batch-load all linked quotations in one query to avoid N+1.
    const qIds = Array.from(new Set(rows.map(r => r.quotationId).filter((x): x is number => x != null)));
    const ownerByQuotation = new Map<number, { preparedById: number | null; approvedById: number | null }>();
    if (qIds.length > 0) {
      const qs = await db
        .select({ id: quotationsTable.id, preparedById: quotationsTable.preparedById, approvedById: quotationsTable.approvedById })
        .from(quotationsTable)
        .where(inArray(quotationsTable.id, qIds));
      for (const q of qs) ownerByQuotation.set(q.id, { preparedById: q.preparedById, approvedById: q.approvedById });
    }
    rows = rows.filter(lpo => {
      const owners = lpo.quotationId != null ? ownerByQuotation.get(lpo.quotationId) : undefined;
      if (!owners) return false;
      return inOwnerScope(ownerScope, owners.preparedById) || inOwnerScope(ownerScope, owners.approvedById);
    });
  }
  const { status, companyId } = req.query;
  if (status) rows = rows.filter(r => r.status === status);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  const enriched = await Promise.all(rows.map(async (lpo) => {
    const [co] = lpo.companyId ? await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, lpo.companyId)) : [undefined];
    return { ...lpo, companyRef: co?.name };
  }));
  res.json(enriched);
});

router.post("/lpos", requirePermission("lpos", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const lpoNumber = await genDocNumber(data.companyId, "LPO", lposTable);
  const [lpo] = await db.insert(lposTable).values({ ...data, lpoNumber }).returning();
  res.status(201).json(lpo);
});

router.get("/lpos/:id/attachments/:idx", requirePermission("lpos", "view"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const idx = parseInt(String(req.params.idx), 10);
  const [lpo] = await db.select().from(lposTable).where(eq(lposTable.id, id));
  if (!lpo) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [lpo]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const ownerScope = await getOwnerScope(req);
  if (ownerScope.kind !== "all") {
    const owners = await lpoOwnerIds(lpo);
    if (!inOwnerScope(ownerScope, owners.preparedById) && !inOwnerScope(ownerScope, owners.approvedById)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
  }
  const atts = (lpo.attachments ?? []) as Array<{ filename: string; contentType: string; size: number; content?: string }>;
  const att = atts[idx];
  if (!att) { res.status(404).json({ error: "Attachment not found" }); return; }
  if (!att.content) { res.status(404).json({ error: "Attachment content not stored" }); return; }
  const buf = Buffer.from(att.content, "base64");
  res.setHeader("Content-Type", att.contentType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${att.filename}"`);
  res.setHeader("Content-Length", buf.length);
  res.send(buf);
});

router.get("/lpos/:id", requirePermission("lpos", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [lpo] = await db.select().from(lposTable).where(eq(lposTable.id, id));
  if (!lpo) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [lpo]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const ownerScope = await getOwnerScope(req);
  if (ownerScope.kind !== "all") {
    const owners = await lpoOwnerIds(lpo);
    if (!inOwnerScope(ownerScope, owners.preparedById) && !inOwnerScope(ownerScope, owners.approvedById)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
  }
  const [co] = lpo.companyId ? await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, lpo.companyId)) : [undefined];
  res.json({ ...lpo, companyRef: co?.name });
});

router.put("/lpos/:id", requirePermission("lpos", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(lposTable).where(eq(lposTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const ownerScope = await getOwnerScope(req);
  if (ownerScope.kind !== "all") {
    const owners = await lpoOwnerIds(existing);
    if (!inOwnerScope(ownerScope, owners.preparedById) && !inOwnerScope(ownerScope, owners.approvedById)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
  }
  const [lpo] = await db.update(lposTable).set({ ...req.body, updatedAt: new Date() }).where(eq(lposTable.id, id)).returning();
  res.json(lpo);
});

router.delete("/lpos/:id", requirePermission("lpos", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(lposTable).where(eq(lposTable.id, id));
  if (existing && !scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  if (existing) {
    const ownerScope = await getOwnerScope(req);
    if (ownerScope.kind !== "all") {
      const owners = await lpoOwnerIds(existing);
      if (!inOwnerScope(ownerScope, owners.preparedById) && !inOwnerScope(ownerScope, owners.approvedById)) {
        res.status(403).json({ error: "Forbidden" }); return;
      }
    }
  }
  await db.delete(lposTable).where(eq(lposTable.id, id));
  res.json({ success: true });
});

export default router;
