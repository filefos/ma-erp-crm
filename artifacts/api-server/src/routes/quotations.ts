import { Router } from "express";
import { db, quotationsTable, quotationItemsTable, companiesTable, usersTable, leadsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { genClientCode } from "../lib/client-code";
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

  // Inherit Client Code: from body → from linked lead → auto-generate per company.
  let clientCode: string | undefined = data.clientCode;
  if (!clientCode && data.leadId) {
    const [lead] = await db.select({ clientCode: leadsTable.clientCode }).from(leadsTable).where(eq(leadsTable.id, data.leadId));
    if (lead?.clientCode) clientCode = lead.clientCode;
  }
  if (!clientCode && data.companyId) {
    clientCode = await genClientCode(data.companyId);
  }

  const [quotation] = await db.insert(quotationsTable).values({
    quotationNumber, companyId: data.companyId, clientName: data.clientName,
    clientEmail: data.clientEmail, clientPhone: data.clientPhone,
    clientContactPerson: data.clientContactPerson, customerTrn: data.customerTrn,
    projectName: data.projectName, projectLocation: data.projectLocation,
    status: data.status ?? "draft", subtotal, discount, vatPercent, vatAmount, grandTotal,
    paymentTerms: data.paymentTerms, deliveryTerms: data.deliveryTerms,
    validity: data.validity, termsConditions: data.termsConditions,
    techSpecs: data.techSpecs, additionalItems: data.additionalItems, customSections: data.customSections,
    preparedById: req.user?.id, leadId: data.leadId,
    clientCode, createdById: req.user?.id,
  } as any).returning();

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
  // Simple approve — Deals were removed from the pipeline.
  const [q] = await db.update(quotationsTable).set({
    status: "approved", approvedById: req.user?.id, updatedAt: new Date(),
  }).where(eq(quotationsTable.id, id)).returning();
  res.json(await enrichQuotation(q));
});

export default router;
