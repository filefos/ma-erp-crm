import { Router } from "express";
import { db, proformaInvoicesTable, taxInvoicesTable, deliveryNotesTable, lposTable, companiesTable, quotationsTable, usersTable, notificationsTable, departmentsTable } from "@workspace/db";
import { and, eq, or, sql, inArray } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess, getOwnerScope, inOwnerScope, ownerScopeFilter } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

// Notify everyone with accounts-side responsibilities about a new/updated LPO
// so the accountant sees it immediately on their dashboard. Best-effort —
// failures are logged but never block the LPO write.
async function notifyAccountsOfLpo(req: any, lpo: any, kind: "created" | "attachment_added") {
  try {
    const recipients = await db
      .selectDistinct({ id: usersTable.id })
      .from(usersTable)
      .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
      .where(
        and(
          eq(usersTable.isActive, true),
          or(
            inArray(sql`lower(coalesce(${usersTable.role}, ''))`, [
              "accountant", "accounts", "accounts_manager", "finance",
            ]),
            inArray(sql`lower(coalesce(${departmentsTable.name}, ''))`, ["accounts", "finance"]),
            eq(usersTable.permissionLevel, "company_admin"),
            eq(usersTable.permissionLevel, "super_admin"),
          ),
        ),
      );
    if (!recipients.length) return;
    const actor = req.user?.name ?? "Someone";
    const title = kind === "created" ? "New LPO uploaded" : "LPO attachment added";
    const message =
      kind === "created"
        ? `${actor} uploaded LPO ${lpo.lpoNumber} from ${lpo.clientName}.`
        : `${actor} added an attachment to LPO ${lpo.lpoNumber} (${lpo.clientName}).`;
    await db.insert(notificationsTable).values(
      recipients.map((r) => ({
        userId: r.id,
        title,
        message,
        type: "lpo",
        entityType: "lpo",
        entityId: lpo.id,
      })),
    );
  } catch (err) {
    req.log?.warn({ err }, "Failed to notify accounts of LPO event");
  }
}

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

  // Inherit Client Code from quotation/lpo if not provided.
  let clientCode: string | undefined = rest.clientCode;
  if (!clientCode && rest.quotationId) {
    const [q] = await db.select({ clientCode: quotationsTable.clientCode }).from(quotationsTable).where(eq(quotationsTable.id, rest.quotationId));
    if (q?.clientCode) clientCode = q.clientCode;
  }
  if (!clientCode && rest.lpoId) {
    const [l] = await db.select({ clientCode: lposTable.clientCode }).from(lposTable).where(eq(lposTable.id, rest.lpoId));
    if (l?.clientCode) clientCode = l.clientCode;
  }

  const [pi] = await db.insert(proformaInvoicesTable).values({
    ...rest, piNumber, clientCode, preparedById: req.user?.id, createdById: req.user?.id, items: itemsStr,
  } as any).returning();
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

  // Inherit Client Code from quotation/lpo if not provided.
  let clientCode: string | undefined = data.clientCode;
  if (!clientCode && data.quotationId) {
    const [q] = await db.select({ clientCode: quotationsTable.clientCode }).from(quotationsTable).where(eq(quotationsTable.id, data.quotationId));
    if (q?.clientCode) clientCode = q.clientCode;
  }
  if (!clientCode && data.lpoId) {
    const [l] = await db.select({ clientCode: lposTable.clientCode }).from(lposTable).where(eq(lposTable.id, data.lpoId));
    if (l?.clientCode) clientCode = l.clientCode;
  }

  // Per-line VAT override: if items contain a `vatPercent` per line, recompute totals from items.
  // Default per-line VAT is the document vatPercent (or 5% UAE).
  const docVat = data.vatPercent ?? 5;
  const items: any[] = Array.isArray(data.items) ? data.items : [];
  let subtotal = data.subtotal ?? 0;
  let vatAmount = data.vatAmount ?? 0;
  let grandTotal = data.grandTotal ?? 0;
  if (items.length > 0 && items.some(i => typeof i.amount === "number" || typeof i.rate === "number")) {
    subtotal = 0; vatAmount = 0;
    for (const it of items) {
      const lineAmount = typeof it.amount === "number" ? it.amount : (it.quantity ?? 1) * (it.rate ?? 0);
      const lineVat = typeof it.vatPercent === "number" ? it.vatPercent : docVat;
      subtotal += lineAmount;
      vatAmount += lineAmount * lineVat / 100;
    }
    subtotal = +subtotal.toFixed(2);
    vatAmount = +vatAmount.toFixed(2);
    grandTotal = +(subtotal + vatAmount).toFixed(2);
  }
  const balance = grandTotal - (data.amountPaid ?? 0);

  // tax_invoices.items column is text — serialize if array passed in.
  const itemsField = items.length > 0 ? JSON.stringify(items) : data.items;

  const [inv] = await db.insert(taxInvoicesTable).values({
    ...data,
    invoiceNumber,
    clientCode,
    items: itemsField,
    subtotal, vatPercent: docVat, vatAmount, grandTotal, balance,
    createdById: req.user?.id,
  } as any).returning();
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

  // Inherit Client Code from quotation/lpo/tax-invoice if not provided.
  let clientCode: string | undefined = data.clientCode;
  if (!clientCode && data.quotationId) {
    const [q] = await db.select({ clientCode: quotationsTable.clientCode }).from(quotationsTable).where(eq(quotationsTable.id, data.quotationId));
    if (q?.clientCode) clientCode = q.clientCode;
  }
  if (!clientCode && data.lpoId) {
    const [l] = await db.select({ clientCode: lposTable.clientCode }).from(lposTable).where(eq(lposTable.id, data.lpoId));
    if (l?.clientCode) clientCode = l.clientCode;
  }
  if (!clientCode && data.taxInvoiceId) {
    const [t] = await db.select({ clientCode: taxInvoicesTable.clientCode }).from(taxInvoicesTable).where(eq(taxInvoicesTable.id, data.taxInvoiceId));
    if (t?.clientCode) clientCode = t.clientCode;
  }

  const [dn] = await db.insert(deliveryNotesTable).values({
    ...data, dnNumber, clientCode, createdById: req.user?.id, items: JSON.stringify(data.items ?? []),
  } as any).returning();
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

  // Inherit Client Code from linked quotation if not provided.
  let clientCode: string | undefined = data.clientCode;
  let quotation: typeof quotationsTable.$inferSelect | undefined;
  if (data.quotationId) {
    const [q] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, data.quotationId));
    quotation = q;
    if (!clientCode && q?.clientCode) clientCode = q.clientCode;
  }

  const [lpo] = await db.insert(lposTable).values({
    ...data, lpoNumber, clientCode, createdById: req.user?.id,
  } as any).returning();
  await notifyAccountsOfLpo(req, lpo, "created");

  // AUTO-CREATE draft Proforma + draft Tax Invoice from this LPO.
  // Per spec: "LPO uses AI extract → user reviews → auto-create BOTH draft Proforma + draft Tax Invoice."
  const today = new Date().toISOString().split("T")[0];
  const value = Number(lpo.lpoValue ?? quotation?.grandTotal ?? 0);
  const vatPercent = 5;
  const subtotal = +(value / (1 + vatPercent / 100)).toFixed(2);
  const vatAmount = +(value - subtotal).toFixed(2);

  let createdPi: any = null;
  let createdTi: any = null;
  try {
    const piNumber = await genDocNumber(lpo.companyId, "PI", proformaInvoicesTable);
    const [pi] = await db.insert(proformaInvoicesTable).values({
      piNumber,
      companyId: lpo.companyId,
      clientCode,
      clientName: lpo.clientName,
      projectName: lpo.projectRef ?? quotation?.projectName ?? null,
      quotationId: lpo.quotationId,
      lpoId: lpo.id,
      subtotal, vatPercent, vatAmount,
      total: value,
      paymentTerms: lpo.paymentTerms,
      validityDate: today,
      status: "draft",
      preparedById: req.user?.id,
      createdById: req.user?.id,
      items: lpo.items ?? "[]",
    } as any).returning();
    createdPi = pi;
  } catch (err) {
    req.log?.warn({ err }, "Failed to auto-create draft Proforma from LPO");
  }
  try {
    const invoiceNumber = await genDocNumber(lpo.companyId, "INV", taxInvoicesTable);
    const [ti] = await db.insert(taxInvoicesTable).values({
      invoiceNumber,
      companyId: lpo.companyId,
      clientCode,
      clientName: lpo.clientName,
      invoiceDate: today,
      supplyDate: today,
      quotationId: lpo.quotationId,
      lpoId: lpo.id,
      paymentTerms: lpo.paymentTerms,
      items: lpo.items ?? "[]",
      subtotal, vatPercent, vatAmount,
      grandTotal: value,
      amountPaid: 0,
      balance: value,
      paymentStatus: "unpaid",
      status: "draft",
      createdById: req.user?.id,
    } as any).returning();
    createdTi = ti;
  } catch (err) {
    req.log?.warn({ err }, "Failed to auto-create draft Tax Invoice from LPO");
  }

  res.status(201).json({
    ...lpo,
    autoCreated: {
      proformaInvoice: createdPi ? { id: createdPi.id, piNumber: createdPi.piNumber } : null,
      taxInvoice: createdTi ? { id: createdTi.id, invoiceNumber: createdTi.invoiceNumber } : null,
    },
  });
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
  // Re-notify accountants only when attachments grew (someone uploaded the
  // client LPO file after the initial save).
  const oldCount = Array.isArray(existing.attachments) ? (existing.attachments as unknown[]).length : 0;
  const newCount = Array.isArray(lpo.attachments) ? (lpo.attachments as unknown[]).length : 0;
  if (newCount > oldCount) {
    await notifyAccountsOfLpo(req, lpo, "attachment_added");
  }
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
