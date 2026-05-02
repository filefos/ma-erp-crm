import { Router } from "express";
import { db, leadsTable, dealsTable, quotationsTable, taxInvoicesTable, inventoryItemsTable, projectsTable, attendanceTable, purchaseRequestsTable, purchaseOrdersTable, expensesTable, chequesTable, proformaInvoicesTable, stockEntriesTable, auditLogsTable, companiesTable, usersTable, departmentsTable } from "@workspace/db";
import { eq, sql, and, inArray, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { Request } from "express";
import { requireAuth, requirePermission, requirePermissionLevel } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

// scoped(req, col) returns a SQL fragment that evaluates true when the row's
// companyId is in the user's accessible scope, or always true for super_admin.
// Use inside .where(and(scoped(req, table.companyId), <other filter>)).
function scoped(req: Request, col: PgColumn): SQL {
  const ids = req.companyScope;
  if (!ids) return sql`true`;
  if (ids.length === 0) return sql`false`;
  return inArray(col, ids);
}

router.get("/dashboard/summary", requirePermission("dashboard", "view"), async (req, res): Promise<void> => {
  const sLeads = scoped(req, leadsTable.companyId);
  const sDeals = scoped(req, dealsTable.companyId);
  const sQuots = scoped(req, quotationsTable.companyId);
  const sInvs  = scoped(req, taxInvoicesTable.companyId);
  const sItems = scoped(req, inventoryItemsTable.companyId);
  const sProj  = scoped(req, projectsTable.companyId);
  const sPR    = scoped(req, purchaseRequestsTable.companyId);
  const sExp   = scoped(req, expensesTable.companyId);

  const [leadsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(leadsTable).where(sLeads);
  const [newLeads] = await db.select({ count: sql<number>`count(*)::int` }).from(leadsTable)
    .where(and(sLeads, sql`date_trunc('month', ${leadsTable.createdAt}) = date_trunc('month', now())`));
  const [hotLeads] = await db.select({ count: sql<number>`count(*)::int` }).from(leadsTable)
    .where(and(sLeads, eq(leadsTable.leadScore, "hot")));
  const [dealsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(dealsTable).where(sDeals);
  const [dealsValue] = await db.select({ sum: sql<number>`coalesce(sum(value), 0)::float` }).from(dealsTable).where(sDeals);
  const [quotCount] = await db.select({ count: sql<number>`count(*)::int` }).from(quotationsTable).where(sQuots);
  const [quotValue] = await db.select({ sum: sql<number>`coalesce(sum(grand_total), 0)::float` }).from(quotationsTable).where(sQuots);
  const [invCount] = await db.select({ count: sql<number>`count(*)::int` }).from(taxInvoicesTable).where(sInvs);
  const [invValue] = await db.select({ sum: sql<number>`coalesce(sum(grand_total), 0)::float` }).from(taxInvoicesTable).where(sInvs);
  const [outstanding] = await db.select({ sum: sql<number>`coalesce(sum(balance), 0)::float` }).from(taxInvoicesTable)
    .where(and(sInvs, sql`balance > 0`));
  const [lowStock] = await db.select({ count: sql<number>`count(*)::int` }).from(inventoryItemsTable)
    .where(and(sItems, sql`current_stock <= minimum_stock`));
  const [activeProjects] = await db.select({ count: sql<number>`count(*)::int` }).from(projectsTable)
    .where(and(sProj, sql`stage not in ('completed', 'handover')`));
  const today = new Date().toISOString().split("T")[0];
  // Attendance has no companyId; scope it via a subquery on the employees table.
  const ids = req.companyScope;
  const todayAttQuery = ids === null || ids === undefined
    ? db.select({ count: sql<number>`count(*)::int` }).from(attendanceTable).where(eq(attendanceTable.date, today))
    : ids.length === 0
      ? db.select({ count: sql<number>`0::int as count` }).from(attendanceTable).where(sql`false`)
      : db.select({ count: sql<number>`count(*)::int` }).from(attendanceTable)
          .where(and(
            eq(attendanceTable.date, today),
            sql`${attendanceTable.employeeId} IN (SELECT id FROM employees WHERE company_id = ANY(${sql.raw(`ARRAY[${ids.join(",")}]::int[]`)}))`,
          ));
  const [todayAtt] = await todayAttQuery;

  // Pending approvals (scoped per source table)
  const [pendingQtns] = await db.select({ count: sql<number>`count(*)::int` }).from(quotationsTable)
    .where(and(sQuots, eq(quotationsTable.status, "sent")));
  const [pendingPR] = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseRequestsTable)
    .where(and(sPR, eq(purchaseRequestsTable.status, "pending")));
  const [pendingExp] = await db.select({ count: sql<number>`count(*)::int` }).from(expensesTable)
    .where(and(sExp, eq(expensesTable.status, "pending")));
  const totalPendingApprovals = (pendingQtns?.count ?? 0) + (pendingPR?.count ?? 0) + (pendingExp?.count ?? 0);

  const [wonDeals] = await db.select({ count: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(value),0)::float` })
    .from(dealsTable).where(and(sDeals, eq(dealsTable.stage, "won"), sql`date_trunc('month', ${dealsTable.createdAt}) = date_trunc('month', now())`));

  res.json({
    totalLeads: leadsCount?.count ?? 0,
    newLeadsThisMonth: newLeads?.count ?? 0,
    hotLeads: hotLeads?.count ?? 0,
    totalDeals: dealsCount?.count ?? 0,
    dealsValue: dealsValue?.sum ?? 0,
    totalQuotations: quotCount?.count ?? 0,
    quotationsValue: quotValue?.sum ?? 0,
    totalInvoices: invCount?.count ?? 0,
    invoicesValue: invValue?.sum ?? 0,
    outstandingReceivables: outstanding?.sum ?? 0,
    pendingApprovals: totalPendingApprovals,
    lowStockItems: lowStock?.count ?? 0,
    activeProjects: activeProjects?.count ?? 0,
    todayAttendance: todayAtt?.count ?? 0,
    wonDealsThisMonth: wonDeals?.count ?? 0,
    wonDealsValue: wonDeals?.sum ?? 0,
  });
});

router.get("/dashboard/sales-pipeline", requirePermission("dashboard", "view"), async (req, res): Promise<void> => {
  const sLeads = scoped(req, leadsTable.companyId);
  const sInvs = scoped(req, taxInvoicesTable.companyId);
  const stages = ["new", "contacted", "qualified", "site_visit", "quotation_required", "quotation_sent", "negotiation", "won", "lost"];
  const stageData = await Promise.all(stages.map(async (stage) => {
    const [r] = await db.select({ count: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(budget),0)::float` })
      .from(leadsTable).where(and(sLeads, eq(leadsTable.status, stage)));
    return { stage, count: r?.count ?? 0, value: r?.sum ?? 0 };
  }));

  const monthlyRevenue = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const [r] = await db.select({ sum: sql<number>`coalesce(sum(grand_total),0)::float` })
      .from(taxInvoicesTable)
      .where(and(sInvs, sql`to_char(${taxInvoicesTable.createdAt}, 'YYYY-MM') = ${month}`));
    monthlyRevenue.push({ month, revenue: r?.sum ?? 0, target: 500000 });
  }

  const sources = await db.select({ source: leadsTable.source, count: sql<number>`count(*)::int` })
    .from(leadsTable)
    .where(sLeads)
    .groupBy(leadsTable.source)
    .orderBy(sql`count(*) desc`)
    .limit(6);

  res.json({
    stages: stageData,
    monthlyRevenue,
    leadSources: sources.map(s => ({ source: s.source ?? "Unknown", count: s.count })),
  });
});

// audit_logs has no company_id column, so only super_admin can read recent
// activity to avoid cross-tenant leakage.
router.get("/dashboard/recent-activity", requirePermissionLevel("super_admin"), async (req, res): Promise<void> => {
  const { limit } = req.query;
  const lim = limit ? parseInt(limit as string, 10) : 20;
  // audit_logs has no company_id column, so company_admin sees the same global
  // stream as super_admin. requirePermissionLevel already restricts to admins.
  const rows = await db.select().from(auditLogsTable).orderBy(sql`${auditLogsTable.createdAt} desc`).limit(lim);
  res.json(rows);
});

router.get("/dashboard/pending-approvals", requirePermission("dashboard", "view"), async (req, res): Promise<void> => {
  const sQuots = scoped(req, quotationsTable.companyId);
  const sPI    = scoped(req, proformaInvoicesTable.companyId);
  const sTI    = scoped(req, taxInvoicesTable.companyId);
  const sPR    = scoped(req, purchaseRequestsTable.companyId);
  const sPO    = scoped(req, purchaseOrdersTable.companyId);
  const sExp   = scoped(req, expensesTable.companyId);
  const sStock = scoped(req, stockEntriesTable.companyId);
  const sChq   = scoped(req, chequesTable.companyId);

  const [quotations] = await db.select({ count: sql<number>`count(*)::int` }).from(quotationsTable)
    .where(and(sQuots, eq(quotationsTable.status, "sent")));
  const [proformaInvoices] = await db.select({ count: sql<number>`count(*)::int` }).from(proformaInvoicesTable)
    .where(and(sPI, eq(proformaInvoicesTable.status, "pending")));
  const [taxInvoices] = await db.select({ count: sql<number>`count(*)::int` }).from(taxInvoicesTable)
    .where(and(sTI, eq(taxInvoicesTable.paymentStatus, "unpaid")));
  const [purchaseRequests] = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseRequestsTable)
    .where(and(sPR, eq(purchaseRequestsTable.status, "pending")));
  const [purchaseOrders] = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseOrdersTable)
    .where(and(sPO, eq(purchaseOrdersTable.status, "draft")));
  const [expenses] = await db.select({ count: sql<number>`count(*)::int` }).from(expensesTable)
    .where(and(sExp, eq(expensesTable.status, "pending")));
  const [stockAdjustments] = await db.select({ count: sql<number>`count(*)::int` }).from(stockEntriesTable)
    .where(and(sStock, eq(stockEntriesTable.approvalStatus, "pending")));
  const [cheques] = await db.select({ count: sql<number>`count(*)::int` }).from(chequesTable)
    .where(and(sChq, eq(chequesTable.status, "draft")));

  res.json({
    quotations: quotations?.count ?? 0,
    proformaInvoices: proformaInvoices?.count ?? 0,
    taxInvoices: taxInvoices?.count ?? 0,
    purchaseRequests: purchaseRequests?.count ?? 0,
    purchaseOrders: purchaseOrders?.count ?? 0,
    expenses: expenses?.count ?? 0,
    stockAdjustments: stockAdjustments?.count ?? 0,
    cheques: cheques?.count ?? 0,
  });
});

router.get("/dashboard/inventory-alerts", requirePermission("inventory_items", "view"), async (req, res): Promise<void> => {
  const sItems = scoped(req, inventoryItemsTable.companyId);
  const rows = await db.select().from(inventoryItemsTable)
    .where(and(sItems, sql`current_stock <= minimum_stock`))
    .orderBy(inventoryItemsTable.name)
    .limit(20);
  res.json(rows);
});

// Admin-only platform overview. company_admin sees their company subset,
// super_admin sees the whole platform. Restricted to company_admin+ levels.
router.get("/dashboard/admin-summary", requirePermissionLevel("company_admin"), async (req, res): Promise<void> => {
  const ids = req.companyScope;
  const sCompanies = ids && ids.length ? inArray(companiesTable.id, ids) : ids && !ids.length ? sql`false` : sql`true`;
  const sUsers = ids && ids.length ? inArray(usersTable.companyId, ids) : ids && !ids.length ? sql`false` : sql`true`;

  const [companies] = await db.select({ count: sql<number>`count(*)::int` }).from(companiesTable).where(sCompanies);
  const [activeCompanies] = await db.select({ count: sql<number>`count(*)::int` }).from(companiesTable)
    .where(and(sCompanies, eq(companiesTable.isActive, true)));
  const [users] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(sUsers);
  const [activeUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable)
    .where(and(sUsers, eq(usersTable.isActive, true)));
  const [depts] = await db.select({ count: sql<number>`count(*)::int` }).from(departmentsTable);
  // audit_logs has no companyId — company_admin sees platform-wide log counts.
  const [logs] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLogsTable);
  const [logins24h] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLogsTable)
    .where(and(eq(auditLogsTable.action, "login"), sql`${auditLogsTable.createdAt} > now() - interval '24 hours'`));
  const [failed24h] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLogsTable)
    .where(and(eq(auditLogsTable.action, "login_failed"), sql`${auditLogsTable.createdAt} > now() - interval '24 hours'`));

  const allCompanies = await db.select().from(companiesTable).where(sCompanies).orderBy(companiesTable.id);
  const companyCards = await Promise.all(allCompanies.map(async (c) => {
    const [u] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.companyId, c.id));
    const [l] = await db.select({ count: sql<number>`count(*)::int` }).from(leadsTable).where(eq(leadsTable.companyId, c.id));
    const [d] = await db.select({ count: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(value),0)::float` })
      .from(dealsTable).where(eq(dealsTable.companyId, c.id));
    const [inv] = await db.select({ sum: sql<number>`coalesce(sum(grand_total),0)::float` })
      .from(taxInvoicesTable).where(eq(taxInvoicesTable.companyId, c.id));
    return {
      id: c.id,
      name: c.name,
      shortName: c.shortName,
      prefix: c.prefix,
      trn: c.trn ?? "",
      logo: c.logo ?? "",
      isActive: c.isActive,
      userCount: u?.count ?? 0,
      leadCount: l?.count ?? 0,
      dealCount: d?.count ?? 0,
      dealsValue: d?.sum ?? 0,
      invoicesValue: inv?.sum ?? 0,
    };
  }));

  res.json({
    totalCompanies: companies?.count ?? 0,
    activeCompanies: activeCompanies?.count ?? 0,
    totalUsers: users?.count ?? 0,
    activeUsers: activeUsers?.count ?? 0,
    totalDepartments: depts?.count ?? 0,
    totalAuditLogs: logs?.count ?? 0,
    logins24h: logins24h?.count ?? 0,
    failedLogins24h: failed24h?.count ?? 0,
    companyCards,
  });
});

export default router;
