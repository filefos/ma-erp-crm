import { Router } from "express";
import { db, suppliersTable, purchaseRequestsTable, purchaseOrdersTable, companiesTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

// Suppliers
router.get("/suppliers", async (req, res): Promise<void> => {
  let rows = await db.select().from(suppliersTable).orderBy(suppliersTable.name);
  const { search } = req.query;
  if (search) {
    const s = (search as string).toLowerCase();
    rows = rows.filter(r => r.name.toLowerCase().includes(s) || r.contactPerson?.toLowerCase().includes(s));
  }
  res.json(rows);
});

router.post("/suppliers", async (req, res): Promise<void> => {
  const [supplier] = await db.insert(suppliersTable).values(req.body).returning();
  res.status(201).json(supplier);
});

router.get("/suppliers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!supplier) { res.status(404).json({ error: "Not found" }); return; }
  res.json(supplier);
});

router.put("/suppliers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [supplier] = await db.update(suppliersTable).set({ ...req.body, updatedAt: new Date() }).where(eq(suppliersTable.id, id)).returning();
  if (!supplier) { res.status(404).json({ error: "Not found" }); return; }
  res.json(supplier);
});

// Purchase Requests
router.get("/purchase-requests", async (req, res): Promise<void> => {
  let rows = await db.select().from(purchaseRequestsTable).orderBy(sql`${purchaseRequestsTable.createdAt} desc`);
  const { status, companyId } = req.query;
  if (status) rows = rows.filter(r => r.status === status);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  const enriched = await Promise.all(rows.map(async (pr) => {
    let requestedByName: string | undefined;
    if (pr.requestedById) {
      const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, pr.requestedById));
      requestedByName = u?.name;
    }
    let items = [];
    try { items = JSON.parse(pr.items ?? "[]"); } catch {}
    return { ...pr, items, requestedByName };
  }));
  res.json(enriched);
});

router.post("/purchase-requests", async (req, res): Promise<void> => {
  const data = req.body;
  const [co] = data.companyId ? await db.select({ prefix: companiesTable.prefix }).from(companiesTable).where(eq(companiesTable.id, data.companyId)) : [{ prefix: "PM" }];
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseRequestsTable);
  const num = (count[0]?.count ?? 0) + 1;
  const prNumber = `${co?.prefix ?? "PM"}-PR-${new Date().getFullYear()}-${String(num).padStart(4, "0")}`;
  const [pr] = await db.insert(purchaseRequestsTable).values({
    ...data, prNumber, requestedById: req.user?.id, items: JSON.stringify(data.items ?? []),
  }).returning();
  let items = [];
  try { items = JSON.parse(pr.items ?? "[]"); } catch {}
  res.status(201).json({ ...pr, items });
});

router.get("/purchase-requests/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [pr] = await db.select().from(purchaseRequestsTable).where(eq(purchaseRequestsTable.id, id));
  if (!pr) { res.status(404).json({ error: "Not found" }); return; }
  let items = [];
  try { items = JSON.parse(pr.items ?? "[]"); } catch {}
  res.json({ ...pr, items });
});

router.put("/purchase-requests/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const data = req.body;
  const [pr] = await db.update(purchaseRequestsTable).set({
    ...data, items: data.items ? JSON.stringify(data.items) : undefined, updatedAt: new Date(),
  }).where(eq(purchaseRequestsTable.id, id)).returning();
  if (!pr) { res.status(404).json({ error: "Not found" }); return; }
  let items = [];
  try { items = JSON.parse(pr.items ?? "[]"); } catch {}
  res.json({ ...pr, items });
});

// Purchase Orders
router.get("/purchase-orders", async (req, res): Promise<void> => {
  let rows = await db.select().from(purchaseOrdersTable).orderBy(sql`${purchaseOrdersTable.createdAt} desc`);
  const { status, supplierId } = req.query;
  if (status) rows = rows.filter(r => r.status === status);
  if (supplierId) rows = rows.filter(r => r.supplierId === parseInt(supplierId as string, 10));
  const enriched = await Promise.all(rows.map(async (po) => {
    let supplierName: string | undefined;
    if (po.supplierId) {
      const [s] = await db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, po.supplierId));
      supplierName = s?.name;
    }
    let items = [];
    try { items = JSON.parse(po.items ?? "[]"); } catch {}
    return { ...po, items, supplierName };
  }));
  res.json(enriched);
});

router.post("/purchase-orders", async (req, res): Promise<void> => {
  const data = req.body;
  const [co] = data.companyId ? await db.select({ prefix: companiesTable.prefix }).from(companiesTable).where(eq(companiesTable.id, data.companyId)) : [{ prefix: "PM" }];
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseOrdersTable);
  const num = (count[0]?.count ?? 0) + 1;
  const poNumber = `${co?.prefix ?? "PM"}-PO-${new Date().getFullYear()}-${String(num).padStart(4, "0")}`;
  const [po] = await db.insert(purchaseOrdersTable).values({
    ...data, poNumber, items: JSON.stringify(data.items ?? []),
  }).returning();
  let items = [];
  try { items = JSON.parse(po.items ?? "[]"); } catch {}
  res.status(201).json({ ...po, items });
});

router.get("/purchase-orders/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!po) { res.status(404).json({ error: "Not found" }); return; }
  let items = [];
  try { items = JSON.parse(po.items ?? "[]"); } catch {}
  res.json({ ...po, items });
});

router.put("/purchase-orders/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const data = req.body;
  const [po] = await db.update(purchaseOrdersTable).set({
    ...data, items: data.items ? JSON.stringify(data.items) : undefined, updatedAt: new Date(),
  }).where(eq(purchaseOrdersTable.id, id)).returning();
  if (!po) { res.status(404).json({ error: "Not found" }); return; }
  let items = [];
  try { items = JSON.parse(po.items ?? "[]"); } catch {}
  res.json({ ...po, items });
});

export default router;
