import { Router } from "express";
import {
  db, projectsTable, companiesTable, usersTable,
  taxInvoicesTable, expensesTable,
  purchaseOrdersTable, purchaseRequestsTable,
} from "@workspace/db";
import { eq, sql, and, inArray } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess, hasPermission } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

async function enrichProject(p: typeof projectsTable.$inferSelect) {
  let companyRef: string | undefined;
  let projectManagerName: string | undefined;
  let salespersonName: string | undefined;
  if (p.companyId) {
    const [co] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, p.companyId));
    companyRef = co?.name;
  }
  if (p.projectManagerId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, p.projectManagerId));
    projectManagerName = u?.name;
  }
  if (p.salespersonId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, p.salespersonId));
    salespersonName = u?.name;
  }
  return { ...p, companyRef, projectManagerName, salespersonName };
}

router.get("/projects", requirePermission("projects", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(projectsTable).orderBy(sql`${projectsTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const { stage, companyId, search } = req.query;
  if (stage) rows = rows.filter(r => r.stage === stage);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (search) {
    const s = (search as string).toLowerCase();
    rows = rows.filter(r => r.projectName.toLowerCase().includes(s) || r.clientName.toLowerCase().includes(s));
  }
  res.json(await Promise.all(rows.map(enrichProject)));
});

router.post("/projects", requirePermission("projects", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const [co] = data.companyId ? await db.select({ prefix: companiesTable.prefix }).from(companiesTable).where(eq(companiesTable.id, data.companyId)) : [{ prefix: "PM" }];
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(projectsTable);
  const num = (count[0]?.count ?? 0) + 1;
  const projectNumber = `${co?.prefix ?? "PM"}-PRJ-${new Date().getFullYear()}-${String(num).padStart(4, "0")}`;
  const [project] = await db.insert(projectsTable).values({ ...data, projectNumber }).returning();
  res.status(201).json(await enrichProject(project));
});

router.get("/projects/:id", requirePermission("projects", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [project]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(await enrichProject(project));
});

router.put("/projects/:id", requirePermission("projects", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [project] = await db.update(projectsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(projectsTable.id, id)).returning();
  res.json(await enrichProject(project));
});

router.get("/projects/:id/cost-summary", requirePermission("projects", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [project]).length) { res.status(403).json({ error: "Forbidden" }); return; }

  const canViewInvoices = await hasPermission(req.user, "tax_invoices", "view");
  const canViewProcurement = await hasPermission(req.user, "purchase_orders", "view");
  const canViewExpenses = await hasPermission(req.user, "expenses", "view");

  const invoices = canViewInvoices
    ? scopeFilter(req, await db.select({
        id: taxInvoicesTable.id, invoiceNumber: taxInvoicesTable.invoiceNumber,
        grandTotal: taxInvoicesTable.grandTotal, amountPaid: taxInvoicesTable.amountPaid,
        paymentStatus: taxInvoicesTable.paymentStatus, companyId: taxInvoicesTable.companyId,
      }).from(taxInvoicesTable).where(eq(taxInvoicesTable.projectId, id)))
    : [];

  let purchaseOrders: Array<{ id: number; poNumber: string; total: number | null; status: string; companyId: number }> = [];
  if (canViewProcurement) {
    const prRows = scopeFilter(req, await db.select({ id: purchaseRequestsTable.id, companyId: purchaseRequestsTable.companyId })
      .from(purchaseRequestsTable).where(eq(purchaseRequestsTable.projectId, id)));
    const prIds = prRows.map(r => r.id);
    if (prIds.length) {
      purchaseOrders = scopeFilter(req, await db.select({
        id: purchaseOrdersTable.id, poNumber: purchaseOrdersTable.poNumber,
        total: purchaseOrdersTable.total, status: purchaseOrdersTable.status,
        companyId: purchaseOrdersTable.companyId,
      }).from(purchaseOrdersTable).where(inArray(purchaseOrdersTable.purchaseRequestId, prIds)));
    }
  }

  const exps = canViewExpenses
    ? scopeFilter(req, await db.select({
        id: expensesTable.id, expenseNumber: expensesTable.expenseNumber,
        total: expensesTable.total, category: expensesTable.category, status: expensesTable.status,
        companyId: expensesTable.companyId,
      }).from(expensesTable).where(and(eq(expensesTable.companyId, project.companyId), sql`${expensesTable.invoiceNumber} = ${project.projectNumber}`)))
    : [];

  const revenue = invoices.reduce((s, r) => s + Number(r.grandTotal ?? 0), 0);
  const collected = invoices.reduce((s, r) => s + Number(r.amountPaid ?? 0), 0);
  const procurementCost = purchaseOrders.reduce((s, r) => s + Number(r.total ?? 0), 0);
  const expensesCost = exps.reduce((s, r) => s + Number(r.total ?? 0), 0);
  const totalCost = procurementCost + expensesCost;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const projectValue = Number(project.projectValue ?? 0);

  res.json({
    projectId: id,
    projectNumber: project.projectNumber,
    projectValue,
    revenue,
    collected,
    procurementCost,
    expensesCost,
    totalCost,
    profit,
    margin,
    invoices,
    purchaseOrders,
    expenses: exps,
    visibility: {
      invoices: canViewInvoices,
      procurement: canViewProcurement,
      expenses: canViewExpenses,
    },
  });
});

export default router;
