import { Router } from "express";
import { db, leadsTable, dealsTable, quotationsTable, taxInvoicesTable, inventoryItemsTable, projectsTable, attendanceTable, purchaseRequestsTable, purchaseOrdersTable, expensesTable, chequesTable, proformaInvoicesTable, stockEntriesTable, auditLogsTable } from "@workspace/db";
import { eq, sql, and, lte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const { companyId } = req.query;
  const cId = companyId ? parseInt(companyId as string, 10) : undefined;

  const [leadsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(leadsTable);
  const [newLeads] = await db.select({ count: sql<number>`count(*)::int` }).from(leadsTable)
    .where(sql`date_trunc('month', ${leadsTable.createdAt}) = date_trunc('month', now())`);
  const [hotLeads] = await db.select({ count: sql<number>`count(*)::int` }).from(leadsTable).where(eq(leadsTable.leadScore, "hot"));
  const [dealsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(dealsTable);
  const [dealsValue] = await db.select({ sum: sql<number>`coalesce(sum(value), 0)::float` }).from(dealsTable);
  const [quotCount] = await db.select({ count: sql<number>`count(*)::int` }).from(quotationsTable);
  const [quotValue] = await db.select({ sum: sql<number>`coalesce(sum(grand_total), 0)::float` }).from(quotationsTable);
  const [invCount] = await db.select({ count: sql<number>`count(*)::int` }).from(taxInvoicesTable);
  const [invValue] = await db.select({ sum: sql<number>`coalesce(sum(grand_total), 0)::float` }).from(taxInvoicesTable);
  const [outstanding] = await db.select({ sum: sql<number>`coalesce(sum(balance), 0)::float` }).from(taxInvoicesTable).where(sql`balance > 0`);
  const [lowStock] = await db.select({ count: sql<number>`count(*)::int` }).from(inventoryItemsTable)
    .where(sql`current_stock <= minimum_stock`);
  const [activeProjects] = await db.select({ count: sql<number>`count(*)::int` }).from(projectsTable)
    .where(sql`stage not in ('completed', 'handover')`);
  const today = new Date().toISOString().split("T")[0];
  const [todayAtt] = await db.select({ count: sql<number>`count(*)::int` }).from(attendanceTable).where(eq(attendanceTable.date, today));
  
  // Pending approvals
  const [pendingQtns] = await db.select({ count: sql<number>`count(*)::int` }).from(quotationsTable).where(eq(quotationsTable.status, "sent"));
  const [pendingPR] = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseRequestsTable).where(eq(purchaseRequestsTable.status, "pending"));
  const [pendingExp] = await db.select({ count: sql<number>`count(*)::int` }).from(expensesTable).where(eq(expensesTable.status, "pending"));
  const totalPendingApprovals = (pendingQtns[0]?.count ?? 0) + (pendingPR[0]?.count ?? 0) + (pendingExp[0]?.count ?? 0);

  const [wonDeals] = await db.select({ count: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(value),0)::float` })
    .from(dealsTable).where(and(eq(dealsTable.stage, "won"), sql`date_trunc('month', ${dealsTable.createdAt}) = date_trunc('month', now())`));

  res.json({
    totalLeads: leadsCount[0]?.count ?? 0,
    newLeadsThisMonth: newLeads[0]?.count ?? 0,
    hotLeads: hotLeads[0]?.count ?? 0,
    totalDeals: dealsCount[0]?.count ?? 0,
    dealsValue: dealsValue[0]?.sum ?? 0,
    totalQuotations: quotCount[0]?.count ?? 0,
    quotationsValue: quotValue[0]?.sum ?? 0,
    totalInvoices: invCount[0]?.count ?? 0,
    invoicesValue: invValue[0]?.sum ?? 0,
    outstandingReceivables: outstanding[0]?.sum ?? 0,
    pendingApprovals: totalPendingApprovals,
    lowStockItems: lowStock[0]?.count ?? 0,
    activeProjects: activeProjects[0]?.count ?? 0,
    todayAttendance: todayAtt[0]?.count ?? 0,
    wonDealsThisMonth: wonDeals[0]?.count ?? 0,
    wonDealsValue: wonDeals[0]?.sum ?? 0,
  });
});

router.get("/dashboard/sales-pipeline", async (req, res): Promise<void> => {
  const stages = ["new", "contacted", "qualified", "site_visit", "quotation_required", "quotation_sent", "negotiation", "won", "lost"];
  const stageData = await Promise.all(stages.map(async (stage) => {
    const [r] = await db.select({ count: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(budget),0)::float` })
      .from(leadsTable).where(eq(leadsTable.status, stage));
    return { stage, count: r?.count ?? 0, value: r?.sum ?? 0 };
  }));

  // Monthly revenue (last 6 months)
  const monthlyRevenue = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const [r] = await db.select({ sum: sql<number>`coalesce(sum(grand_total),0)::float` })
      .from(taxInvoicesTable)
      .where(sql`to_char(${taxInvoicesTable.createdAt}, 'YYYY-MM') = ${month}`);
    monthlyRevenue.push({ month, revenue: r?.sum ?? 0, target: 500000 });
  }

  // Lead sources
  const sources = await db.select({ source: leadsTable.source, count: sql<number>`count(*)::int` })
    .from(leadsTable)
    .groupBy(leadsTable.source)
    .orderBy(sql`count(*) desc`)
    .limit(6);

  res.json({
    stages: stageData,
    monthlyRevenue,
    leadSources: sources.map(s => ({ source: s.source ?? "Unknown", count: s.count })),
  });
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const { limit } = req.query;
  const lim = limit ? parseInt(limit as string, 10) : 20;
  const rows = await db.select().from(auditLogsTable).orderBy(sql`${auditLogsTable.createdAt} desc`).limit(lim);
  res.json(rows);
});

router.get("/dashboard/pending-approvals", async (req, res): Promise<void> => {
  const [quotations] = await db.select({ count: sql<number>`count(*)::int` }).from(quotationsTable).where(eq(quotationsTable.status, "sent"));
  const [proformaInvoices] = await db.select({ count: sql<number>`count(*)::int` }).from(proformaInvoicesTable).where(eq(proformaInvoicesTable.status, "pending"));
  const [taxInvoices] = await db.select({ count: sql<number>`count(*)::int` }).from(taxInvoicesTable).where(eq(taxInvoicesTable.paymentStatus, "unpaid"));
  const [purchaseRequests] = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseRequestsTable).where(eq(purchaseRequestsTable.status, "pending"));
  const [purchaseOrders] = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseOrdersTable).where(eq(purchaseOrdersTable.status, "draft"));
  const [expenses] = await db.select({ count: sql<number>`count(*)::int` }).from(expensesTable).where(eq(expensesTable.status, "pending"));
  const [stockAdjustments] = await db.select({ count: sql<number>`count(*)::int` }).from(stockEntriesTable).where(eq(stockEntriesTable.approvalStatus, "pending"));
  const [cheques] = await db.select({ count: sql<number>`count(*)::int` }).from(chequesTable).where(eq(chequesTable.status, "draft"));

  res.json({
    quotations: quotations[0]?.count ?? 0,
    proformaInvoices: proformaInvoices[0]?.count ?? 0,
    taxInvoices: taxInvoices[0]?.count ?? 0,
    purchaseRequests: purchaseRequests[0]?.count ?? 0,
    purchaseOrders: purchaseOrders[0]?.count ?? 0,
    expenses: expenses[0]?.count ?? 0,
    stockAdjustments: stockAdjustments[0]?.count ?? 0,
    cheques: cheques[0]?.count ?? 0,
  });
});

router.get("/dashboard/inventory-alerts", async (req, res): Promise<void> => {
  const rows = await db.select().from(inventoryItemsTable)
    .where(sql`current_stock <= minimum_stock`)
    .orderBy(inventoryItemsTable.name)
    .limit(20);
  res.json(rows);
});

export default router;
