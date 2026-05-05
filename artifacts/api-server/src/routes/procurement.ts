import { Router } from "express";
import { db, suppliersTable, purchaseRequestsTable, purchaseOrdersTable, rfqsTable, supplierQuotationsTable, companiesTable, usersTable, projectsTable } from "@workspace/db";
import { eq, sql, and, inArray } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess, inScope } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseJson(str: string | null | undefined): any[] {
  try { return JSON.parse(str ?? "[]"); } catch { return []; }
}

async function getCompanyPrefix(companyId: number): Promise<string> {
  const [co] = await db.select({ prefix: companiesTable.prefix }).from(companiesTable).where(eq(companiesTable.id, companyId));
  return co?.prefix ?? "PM";
}

function stripFields(obj: any, ...fields: string[]): any {
  const copy: any = { ...obj };
  for (const f of fields) delete copy[f];
  return copy;
}

async function enrichSupplier(s: any) {
  return s;
}

async function enrichPr(pr: any) {
  let requestedByName: string | undefined;
  let approvedByName: string | undefined;
  if (pr.requestedById) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, pr.requestedById));
    requestedByName = u?.name;
  }
  if (pr.approvedById) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, pr.approvedById));
    approvedByName = u?.name;
  }
  return { ...pr, items: parseJson(pr.items), requestedByName, approvedByName };
}

async function enrichRfq(rfq: any) {
  let prNumber: string | undefined;
  if (rfq.purchaseRequestId) {
    const [pr] = await db.select({ prNumber: purchaseRequestsTable.prNumber }).from(purchaseRequestsTable).where(eq(purchaseRequestsTable.id, rfq.purchaseRequestId));
    prNumber = pr?.prNumber;
  }
  let createdByName: string | undefined;
  if (rfq.createdById) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, rfq.createdById));
    createdByName = u?.name;
  }
  const supplierIds = parseJson(rfq.supplierIds);
  const suppliers = await Promise.all(supplierIds.map(async (id: number) => {
    const [s] = await db.select({ id: suppliersTable.id, name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, id));
    return s;
  }));
  return { ...rfq, items: parseJson(rfq.items), supplierIds, suppliers: suppliers.filter(Boolean), prNumber, createdByName };
}

async function enrichSq(sq: any) {
  let supplierName: string | undefined;
  let rfqNumber: string | undefined;
  if (sq.supplierId) {
    const [s] = await db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, sq.supplierId));
    supplierName = s?.name;
  }
  if (sq.rfqId) {
    const [r] = await db.select({ rfqNumber: rfqsTable.rfqNumber }).from(rfqsTable).where(eq(rfqsTable.id, sq.rfqId));
    rfqNumber = r?.rfqNumber;
  }
  return { ...sq, items: parseJson(sq.items), supplierName, rfqNumber };
}

async function enrichPo(po: any) {
  let supplierName: string | undefined;
  let approvedByName: string | undefined;
  let preparedByName: string | undefined;
  let prNumber: string | undefined;
  let rfqNumber: string | undefined;
  if (po.supplierId) {
    const [s] = await db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, po.supplierId));
    supplierName = s?.name;
  }
  if (po.approvedById) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, po.approvedById));
    approvedByName = u?.name;
  }
  if (po.preparedById) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, po.preparedById));
    preparedByName = u?.name;
  }
  if (po.purchaseRequestId) {
    const [pr] = await db.select({ prNumber: purchaseRequestsTable.prNumber }).from(purchaseRequestsTable).where(eq(purchaseRequestsTable.id, po.purchaseRequestId));
    prNumber = pr?.prNumber;
  }
  if (po.rfqId) {
    const [r] = await db.select({ rfqNumber: rfqsTable.rfqNumber }).from(rfqsTable).where(eq(rfqsTable.id, po.rfqId));
    rfqNumber = r?.rfqNumber;
  }
  return { ...po, items: parseJson(po.items), supplierName, approvedByName, preparedByName, prNumber, rfqNumber };
}

// ─── Suppliers ──────────────────────────────────────────────────────────────

router.get("/suppliers", requirePermission("suppliers", "view"), async (req, res): Promise<void> => {
  // suppliers may be company-scoped or global (companyId null)
  let rows = await db.select().from(suppliersTable).orderBy(suppliersTable.name);
  rows = scopeFilter(req, rows);
  const { search, status, companyId } = req.query;
  if (search) {
    const s = (search as string).toLowerCase();
    rows = rows.filter(r => r.name.toLowerCase().includes(s) || r.contactPerson?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s));
  }
  if (status) rows = rows.filter(r => r.status === status);
  if (companyId) rows = rows.filter(r => !r.companyId || r.companyId === parseInt(companyId as string, 10));
  res.json(rows);
});

router.post("/suppliers", requirePermission("suppliers", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const [supplier] = await db.insert(suppliersTable).values(req.body).returning();
  res.status(201).json(supplier);
});

router.get("/suppliers/:id", requirePermission("suppliers", "view"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!supplier) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [supplier]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(supplier);
});

router.put("/suppliers/:id", requirePermission("suppliers", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [supplier] = await db.update(suppliersTable).set({ ...req.body, updatedAt: new Date() }).where(eq(suppliersTable.id, id)).returning();
  res.json(supplier);
});

router.delete("/suppliers/:id", requirePermission("suppliers", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(suppliersTable).where(eq(suppliersTable.id, id));
  res.json({ success: true });
});

// ─── Purchase Requests ───────────────────────────────────────────────────────

router.get("/purchase-requests", requirePermission("purchase_requests", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(purchaseRequestsTable).orderBy(sql`${purchaseRequestsTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const { status, companyId, priority } = req.query;
  if (status) rows = rows.filter(r => r.status === status);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (priority) rows = rows.filter(r => r.priority === priority);
  const enriched = await Promise.all(rows.map(enrichPr));
  res.json(enriched);
});

router.post("/purchase-requests", requirePermission("purchase_requests", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = stripFields(req.body, "status", "approvedById", "rejectionReason");
  const prefix = await getCompanyPrefix(data.companyId);
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseRequestsTable);
  const num = (count[0]?.count ?? 0) + 1;
  const prNumber = `${prefix}-PR-${new Date().getFullYear()}-${String(num).padStart(4, "0")}`;
  const [pr] = await db.insert(purchaseRequestsTable).values({
    ...data, prNumber, requestedById: req.user?.id, status: "draft",
    items: JSON.stringify(data.items ?? []),
  }).returning();
  res.status(201).json(await enrichPr(pr));
});

router.get("/purchase-requests/:id", requirePermission("purchase_requests", "view"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [pr] = await db.select().from(purchaseRequestsTable).where(eq(purchaseRequestsTable.id, id));
  if (!pr) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [pr]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(await enrichPr(pr));
});

router.put("/purchase-requests/:id", requirePermission("purchase_requests", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(purchaseRequestsTable).where(eq(purchaseRequestsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  if (existing.status === "approved") { res.status(400).json({ error: "Cannot edit approved PR" }); return; }
  const data = stripFields(req.body, "status", "approvedById", "rejectionReason");
  const [pr] = await db.update(purchaseRequestsTable).set({
    ...data, items: data.items ? JSON.stringify(data.items) : undefined, updatedAt: new Date(),
  }).where(eq(purchaseRequestsTable.id, id)).returning();
  res.json(await enrichPr(pr));
});

router.post("/purchase-requests/:id/submit", requirePermission("purchase_requests", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(purchaseRequestsTable).where(eq(purchaseRequestsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [pr] = await db.update(purchaseRequestsTable).set({ status: "submitted", updatedAt: new Date() }).where(eq(purchaseRequestsTable.id, id)).returning();
  res.json(await enrichPr(pr));
});

router.post("/purchase-requests/:id/approve", requirePermission("purchase_requests", "approve"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(purchaseRequestsTable).where(eq(purchaseRequestsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [pr] = await db.update(purchaseRequestsTable).set({ status: "approved", approvedById: req.user?.id, updatedAt: new Date() }).where(eq(purchaseRequestsTable.id, id)).returning();
  res.json(await enrichPr(pr));
});

router.post("/purchase-requests/:id/reject", requirePermission("purchase_requests", "approve"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(purchaseRequestsTable).where(eq(purchaseRequestsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const { reason } = req.body;
  const [pr] = await db.update(purchaseRequestsTable).set({ status: "rejected", rejectionReason: reason, approvedById: req.user?.id, updatedAt: new Date() }).where(eq(purchaseRequestsTable.id, id)).returning();
  res.json(await enrichPr(pr));
});

// ─── RFQs ───────────────────────────────────────────────────────────────────

router.get("/rfqs", requirePermission("purchase_requests", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(rfqsTable).orderBy(sql`${rfqsTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const { status, companyId } = req.query;
  if (status) rows = rows.filter(r => r.status === status);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  const enriched = await Promise.all(rows.map(enrichRfq));
  res.json(enriched);
});

router.post("/rfqs", requirePermission("purchase_requests", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const prefix = await getCompanyPrefix(data.companyId);
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(rfqsTable);
  const num = (count[0]?.count ?? 0) + 1;
  const rfqNumber = `${prefix}-RFQ-${new Date().getFullYear()}-${String(num).padStart(4, "0")}`;
  const [rfq] = await db.insert(rfqsTable).values({
    ...data, rfqNumber, createdById: req.user?.id,
    items: JSON.stringify(data.items ?? []),
    supplierIds: JSON.stringify(data.supplierIds ?? []),
  }).returning();
  res.status(201).json(await enrichRfq(rfq));
});

router.get("/rfqs/:id", requirePermission("purchase_requests", "view"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [rfq] = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id));
  if (!rfq) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [rfq]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(await enrichRfq(rfq));
});

router.put("/rfqs/:id", requirePermission("purchase_requests", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  if (existing.status === "closed") { res.status(400).json({ error: "Cannot edit closed RFQ" }); return; }
  const data = req.body;
  const [rfq] = await db.update(rfqsTable).set({
    ...data,
    items: data.items ? JSON.stringify(data.items) : undefined,
    supplierIds: data.supplierIds ? JSON.stringify(data.supplierIds) : undefined,
    updatedAt: new Date(),
  }).where(eq(rfqsTable.id, id)).returning();
  res.json(await enrichRfq(rfq));
});

router.delete("/rfqs/:id", requirePermission("purchase_requests", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(rfqsTable).where(eq(rfqsTable.id, id));
  res.json({ success: true });
});

router.post("/rfqs/:id/send", requirePermission("purchase_requests", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [rfq] = await db.update(rfqsTable).set({ status: "sent", updatedAt: new Date() }).where(eq(rfqsTable.id, id)).returning();
  res.json(await enrichRfq(rfq));
});

router.post("/rfqs/:id/close", requirePermission("purchase_requests", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [rfq] = await db.update(rfqsTable).set({ status: "closed", updatedAt: new Date() }).where(eq(rfqsTable.id, id)).returning();
  res.json(await enrichRfq(rfq));
});

// ─── Supplier Quotations ─────────────────────────────────────────────────────

router.get("/supplier-quotations", requirePermission("purchase_requests", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(supplierQuotationsTable).orderBy(sql`${supplierQuotationsTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const { status, companyId, rfqId } = req.query;
  if (status) rows = rows.filter(r => r.status === status);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (rfqId) rows = rows.filter(r => r.rfqId === parseInt(rfqId as string, 10));
  const enriched = await Promise.all(rows.map(enrichSq));
  res.json(enriched);
});

router.post("/supplier-quotations", requirePermission("purchase_requests", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = stripFields(req.body, "status", "selectionReason");
  const prefix = await getCompanyPrefix(data.companyId);
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(supplierQuotationsTable);
  const num = (count[0]?.count ?? 0) + 1;
  const sqNumber = `${prefix}-SQ-${new Date().getFullYear()}-${String(num).padStart(4, "0")}`;
  const items = data.items ?? [];
  const subtotal = items.reduce((s: number, i: any) => s + ((i.unitPrice ?? 0) * (i.quantity ?? 1)), 0);
  const vatAmount = items.reduce((s: number, i: any) => s + (i.vat ?? 0), 0);
  const total = subtotal + vatAmount;
  const [sq] = await db.insert(supplierQuotationsTable).values({
    ...data, sqNumber, createdById: req.user?.id,
    subtotal, vatAmount, total,
    items: JSON.stringify(items),
  }).returning();
  res.status(201).json(await enrichSq(sq));
});

router.get("/supplier-quotations/:id", requirePermission("purchase_requests", "view"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [sq] = await db.select().from(supplierQuotationsTable).where(eq(supplierQuotationsTable.id, id));
  if (!sq) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [sq]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(await enrichSq(sq));
});

router.put("/supplier-quotations/:id", requirePermission("purchase_requests", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(supplierQuotationsTable).where(eq(supplierQuotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const data = stripFields(req.body, "status", "selectionReason");
  const items = data.items ?? parseJson(existing.items);
  const subtotal = items.reduce((s: number, i: any) => s + ((i.unitPrice ?? 0) * (i.quantity ?? 1)), 0);
  const vatAmount = items.reduce((s: number, i: any) => s + (i.vat ?? 0), 0);
  const total = subtotal + vatAmount;
  const [sq] = await db.update(supplierQuotationsTable).set({
    ...data, subtotal, vatAmount, total,
    items: data.items ? JSON.stringify(data.items) : undefined,
    updatedAt: new Date(),
  }).where(eq(supplierQuotationsTable.id, id)).returning();
  res.json(await enrichSq(sq));
});

router.delete("/supplier-quotations/:id", requirePermission("purchase_requests", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(supplierQuotationsTable).where(eq(supplierQuotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(supplierQuotationsTable).where(eq(supplierQuotationsTable.id, id));
  res.json({ success: true });
});

router.post("/supplier-quotations/:id/select", requirePermission("purchase_requests", "approve"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const { reason } = req.body;
  const [sq] = await db.select().from(supplierQuotationsTable).where(eq(supplierQuotationsTable.id, id));
  if (!sq) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [sq]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  // Mark others in same RFQ as rejected
  if (sq.rfqId) {
    await db.update(supplierQuotationsTable).set({ status: "rejected", updatedAt: new Date() })
      .where(eq(supplierQuotationsTable.rfqId, sq.rfqId));
  }
  const [selected] = await db.update(supplierQuotationsTable).set({ status: "selected", selectionReason: reason, updatedAt: new Date() }).where(eq(supplierQuotationsTable.id, id)).returning();
  // Mark RFQ as quotation received
  if (sq.rfqId) {
    await db.update(rfqsTable).set({ status: "quotation_received", updatedAt: new Date() }).where(eq(rfqsTable.id, sq.rfqId));
  }
  res.json(await enrichSq(selected));
});

router.post("/supplier-quotations/:id/reject", requirePermission("purchase_requests", "approve"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(supplierQuotationsTable).where(eq(supplierQuotationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [sq] = await db.update(supplierQuotationsTable).set({ status: "rejected", updatedAt: new Date() }).where(eq(supplierQuotationsTable.id, id)).returning();
  res.json(await enrichSq(sq));
});

// ─── Purchase Orders ─────────────────────────────────────────────────────────

router.get("/purchase-orders", requirePermission("purchase_orders", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(purchaseOrdersTable).orderBy(sql`${purchaseOrdersTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const { status, supplierId, companyId } = req.query;
  if (status) rows = rows.filter(r => r.status === status);
  if (supplierId) rows = rows.filter(r => r.supplierId === parseInt(supplierId as string, 10));
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  const enriched = await Promise.all(rows.map(enrichPo));
  res.json(enriched);
});

router.post("/purchase-orders", requirePermission("purchase_orders", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = stripFields(req.body, "status", "approvedById", "rejectionReason");
  const prefix = await getCompanyPrefix(data.companyId);
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseOrdersTable);
  const num = (count[0]?.count ?? 0) + 1;
  const poNumber = `${prefix}-PO-${new Date().getFullYear()}-${String(num).padStart(4, "0")}`;
  const items = data.items ?? [];
  const subtotal = items.reduce((s: number, i: any) => s + ((i.rate ?? i.unitPrice ?? 0) * (i.quantity ?? 1)), 0);
  const vatAmount = subtotal * 0.05;
  const total = subtotal + vatAmount;
  let projectRef: string | undefined = data.projectRef;
  if (!projectRef && data.projectId) {
    const [proj] = await db.select({ projectNumber: projectsTable.projectNumber }).from(projectsTable).where(eq(projectsTable.id, data.projectId));
    projectRef = proj?.projectNumber ?? undefined;
  }
  const [po] = await db.insert(purchaseOrdersTable).values({
    ...data, poNumber, projectRef, preparedById: req.user?.id,
    subtotal, vatAmount, total,
    items: JSON.stringify(items),
  }).returning();
  res.status(201).json(await enrichPo(po));
});

router.get("/purchase-orders/:id", requirePermission("purchase_orders", "view"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!po) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [po]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(await enrichPo(po));
});

router.put("/purchase-orders/:id", requirePermission("purchase_orders", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  if (["approved", "issued"].includes(existing.status)) { res.status(400).json({ error: "Cannot edit approved/issued PO" }); return; }
  const data = stripFields(req.body, "status", "approvedById", "rejectionReason");
  const items = data.items ?? parseJson(existing.items);
  const subtotal = items.reduce((s: number, i: any) => s + ((i.rate ?? i.unitPrice ?? 0) * (i.quantity ?? 1)), 0);
  const vatAmount = subtotal * 0.05;
  const total = subtotal + vatAmount;
  const [po] = await db.update(purchaseOrdersTable).set({
    ...data, subtotal, vatAmount, total,
    items: data.items ? JSON.stringify(data.items) : undefined,
    updatedAt: new Date(),
  }).where(eq(purchaseOrdersTable.id, id)).returning();
  res.json(await enrichPo(po));
});

router.delete("/purchase-orders/:id", requirePermission("purchase_orders", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  if (["approved", "issued"].includes(existing.status)) { res.status(400).json({ error: "Cannot delete approved/issued PO" }); return; }
  await db.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  res.json({ success: true });
});

router.post("/purchase-orders/:id/submit", requirePermission("purchase_orders", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [po] = await db.update(purchaseOrdersTable).set({ status: "submitted", updatedAt: new Date() }).where(eq(purchaseOrdersTable.id, id)).returning();
  res.json(await enrichPo(po));
});

router.post("/purchase-orders/:id/approve", requirePermission("purchase_orders", "approve"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [po] = await db.update(purchaseOrdersTable).set({ status: "approved", approvedById: req.user?.id, updatedAt: new Date() }).where(eq(purchaseOrdersTable.id, id)).returning();
  res.json(await enrichPo(po));
});

router.post("/purchase-orders/:id/reject", requirePermission("purchase_orders", "approve"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const { reason } = req.body;
  const [po] = await db.update(purchaseOrdersTable).set({ status: "rejected", rejectionReason: reason, updatedAt: new Date() }).where(eq(purchaseOrdersTable.id, id)).returning();
  res.json(await enrichPo(po));
});

router.post("/purchase-orders/:id/issue", requirePermission("purchase_orders", "approve"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  if (existing.status !== "approved") { res.status(400).json({ error: "PO must be approved before issuing" }); return; }
  const [po] = await db.update(purchaseOrdersTable).set({ status: "issued", updatedAt: new Date() }).where(eq(purchaseOrdersTable.id, id)).returning();
  res.json(await enrichPo(po));
});

router.post("/purchase-orders/:id/cancel", requirePermission("purchase_orders", "approve"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const { reason } = req.body;
  if (!reason) { res.status(400).json({ error: "Cancellation reason required" }); return; }
  const [existing] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [po] = await db.update(purchaseOrdersTable).set({ status: "cancelled", rejectionReason: reason, updatedAt: new Date() }).where(eq(purchaseOrdersTable.id, id)).returning();
  res.json(await enrichPo(po));
});

// ─── Procurement Dashboard ───────────────────────────────────────────────────

router.get("/procurement/dashboard", requirePermission("purchase_requests", "view"), async (req, res): Promise<void> => {
  const scope = req.companyScope;
  // Build a company scope predicate for each table
  function scopePred(col: any) {
    if (scope === null || scope === undefined) return undefined;
    if (scope.length === 0) return sql`1=0`;
    return inArray(col, scope);
  }

  const supplierPred = scopePred(suppliersTable.companyId);
  const prPred = scopePred(purchaseRequestsTable.companyId);
  const rfqPred = scopePred(rfqsTable.companyId);
  const sqPred = scopePred(supplierQuotationsTable.companyId);
  const poPred = scopePred(purchaseOrdersTable.companyId);

  const [suppliersCount] = await db.select({ count: sql<number>`count(*)::int` }).from(suppliersTable)
    .where(supplierPred);
  const [activeSuppliers] = await db.select({ count: sql<number>`count(*)::int` }).from(suppliersTable)
    .where(supplierPred ? and(eq(suppliersTable.status, "active"), supplierPred) : eq(suppliersTable.status, "active"));
  const [prPending] = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseRequestsTable)
    .where(prPred ? and(eq(purchaseRequestsTable.status, "submitted"), prPred) : eq(purchaseRequestsTable.status, "submitted"));
  const [prApproved] = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseRequestsTable)
    .where(prPred ? and(eq(purchaseRequestsTable.status, "approved"), prPred) : eq(purchaseRequestsTable.status, "approved"));
  const [rfqSent] = await db.select({ count: sql<number>`count(*)::int` }).from(rfqsTable)
    .where(rfqPred ? and(eq(rfqsTable.status, "sent"), rfqPred) : eq(rfqsTable.status, "sent"));
  const [sqReceived] = await db.select({ count: sql<number>`count(*)::int` }).from(supplierQuotationsTable)
    .where(sqPred ? and(eq(supplierQuotationsTable.status, "received"), sqPred) : eq(supplierQuotationsTable.status, "received"));
  const [poIssued] = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseOrdersTable)
    .where(poPred ? and(eq(purchaseOrdersTable.status, "issued"), poPred) : eq(purchaseOrdersTable.status, "issued"));
  const [poPending] = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseOrdersTable)
    .where(poPred ? and(eq(purchaseOrdersTable.status, "submitted"), poPred) : eq(purchaseOrdersTable.status, "submitted"));
  const [poTotal] = await db.select({ total: sql<number>`coalesce(sum(total), 0)` }).from(purchaseOrdersTable)
    .where(poPred);

  res.json({
    totalSuppliers: suppliersCount.count,
    activeSuppliers: activeSuppliers.count,
    prPending: prPending.count,
    prApproved: prApproved.count,
    rfqSent: rfqSent.count,
    sqReceived: sqReceived.count,
    poIssued: poIssued.count,
    poPending: poPending.count,
    totalPoValue: poTotal.total,
  });
});

export default router;
