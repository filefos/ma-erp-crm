import { Router } from "express";
import { db, bankAccountsTable, chequesTable, expensesTable, companiesTable, suppliersTable, chartOfAccountsTable, paymentsReceivedTable, paymentsMadeTable, journalEntriesTable, journalEntryLinesTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

// Bank Accounts
router.get("/bank-accounts", requirePermission("bank_accounts", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(bankAccountsTable).orderBy(bankAccountsTable.bankName);
  rows = scopeFilter(req, rows);
  const { companyId } = req.query;
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  res.json(rows);
});

router.post("/bank-accounts", requirePermission("bank_accounts", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const [acc] = await db.insert(bankAccountsTable).values(req.body).returning();
  res.status(201).json(acc);
});

router.put("/bank-accounts/:id", requirePermission("bank_accounts", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [acc] = await db.update(bankAccountsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(bankAccountsTable.id, id)).returning();
  res.json(acc);
});

// Cheques
router.get("/cheques", requirePermission("cheques", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(chequesTable).orderBy(sql`${chequesTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const { status, companyId, bankAccountId } = req.query;
  if (status) rows = rows.filter(r => r.status === status);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (bankAccountId) rows = rows.filter(r => r.bankAccountId === parseInt(bankAccountId as string, 10));
  const enriched = await Promise.all(rows.map(async (c) => {
    const [acc] = await db.select({ bankName: bankAccountsTable.bankName }).from(bankAccountsTable).where(eq(bankAccountsTable.id, c.bankAccountId));
    return { ...c, bankName: acc?.bankName };
  }));
  res.json(enriched);
});

router.post("/cheques", requirePermission("cheques", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const words = numberToWords(data.amount ?? 0);
  const [cheque] = await db.insert(chequesTable).values({
    ...data, amountInWords: words + " UAE Dirhams Only", preparedById: req.user?.id,
  }).returning();
  res.status(201).json(cheque);
});

router.get("/cheques/:id", requirePermission("cheques", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [cheque] = await db.select().from(chequesTable).where(eq(chequesTable.id, id));
  if (!cheque) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [cheque]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(cheque);
});

router.put("/cheques/:id", requirePermission("cheques", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(chequesTable).where(eq(chequesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [cheque] = await db.update(chequesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(chequesTable.id, id)).returning();
  res.json(cheque);
});

// Expenses
router.get("/expenses", requirePermission("expenses", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(expensesTable).orderBy(sql`${expensesTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const { status, companyId, category } = req.query;
  if (status) rows = rows.filter(r => r.status === status);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (category) rows = rows.filter(r => r.category === category);
  const enriched = await Promise.all(rows.map(async (e) => {
    let supplierName: string | undefined;
    if (e.supplierId) {
      const [s] = await db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, e.supplierId));
      supplierName = s?.name;
    }
    return { ...e, supplierName };
  }));
  res.json(enriched);
});

router.post("/expenses", requirePermission("expenses", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(expensesTable);
  const num = (count[0]?.count ?? 0) + 1;
  const expenseNumber = `EXP-${new Date().getFullYear()}-${String(num).padStart(5, "0")}`;
  const [expense] = await db.insert(expensesTable).values({ ...data, expenseNumber, createdById: req.user?.id }).returning();
  res.status(201).json(expense);
});

router.get("/expenses/:id", requirePermission("expenses", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [expense] = await db.select().from(expensesTable).where(eq(expensesTable.id, id));
  if (!expense) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [expense]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(expense);
});

router.put("/expenses/:id", requirePermission("expenses", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(expensesTable).where(eq(expensesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [expense] = await db.update(expensesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(expensesTable.id, id)).returning();
  res.json(expense);
});

router.delete("/expenses/:id", requirePermission("expenses", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(expensesTable).where(eq(expensesTable.id, id));
  if (existing && !scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(expensesTable).where(eq(expensesTable.id, id));
  res.json({ success: true });
});

// Chart of Accounts
router.get("/chart-of-accounts", requirePermission("expenses", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(chartOfAccountsTable).orderBy(chartOfAccountsTable.accountCode);
  rows = scopeFilter(req, rows);
  const { companyId, accountType } = req.query;
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (accountType) rows = rows.filter(r => r.accountType === accountType);
  res.json(rows);
});

router.post("/chart-of-accounts", requirePermission("expenses", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const [acc] = await db.insert(chartOfAccountsTable).values(req.body).returning();
  res.status(201).json(acc);
});

router.put("/chart-of-accounts/:id", requirePermission("expenses", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(chartOfAccountsTable).where(eq(chartOfAccountsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [acc] = await db.update(chartOfAccountsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(chartOfAccountsTable.id, id)).returning();
  res.json(acc);
});

router.delete("/chart-of-accounts/:id", requirePermission("expenses", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(chartOfAccountsTable).where(eq(chartOfAccountsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(chartOfAccountsTable).where(eq(chartOfAccountsTable.id, id));
  res.json({ success: true });
});

// Payments Received
router.get("/payments-received", requirePermission("expenses", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(paymentsReceivedTable).orderBy(sql`${paymentsReceivedTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const { companyId } = req.query;
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  const enriched = await Promise.all(rows.map(async (p) => {
    let bankAccountName: string | undefined;
    if (p.bankAccountId) {
      const [b] = await db.select({ accountName: bankAccountsTable.accountName, bankName: bankAccountsTable.bankName }).from(bankAccountsTable).where(eq(bankAccountsTable.id, p.bankAccountId));
      bankAccountName = b ? `${b.bankName} – ${b.accountName}` : undefined;
    }
    return { ...p, bankAccountName };
  }));
  res.json(enriched);
});

router.post("/payments-received", requirePermission("expenses", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(paymentsReceivedTable);
  const num = (count[0]?.count ?? 0) + 1;
  const paymentNumber = `RCV-${new Date().getFullYear()}-${String(num).padStart(5, "0")}`;
  const [payment] = await db.insert(paymentsReceivedTable).values({ ...data, paymentNumber }).returning();
  res.status(201).json(payment);
});

router.put("/payments-received/:id", requirePermission("expenses", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(paymentsReceivedTable).where(eq(paymentsReceivedTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [payment] = await db.update(paymentsReceivedTable).set({ ...req.body, updatedAt: new Date() }).where(eq(paymentsReceivedTable.id, id)).returning();
  res.json(payment);
});

router.delete("/payments-received/:id", requirePermission("expenses", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(paymentsReceivedTable).where(eq(paymentsReceivedTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(paymentsReceivedTable).where(eq(paymentsReceivedTable.id, id));
  res.json({ success: true });
});

// Payments Made
router.get("/payments-made", requirePermission("expenses", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(paymentsMadeTable).orderBy(sql`${paymentsMadeTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const { companyId } = req.query;
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  const enriched = await Promise.all(rows.map(async (p) => {
    let bankAccountName: string | undefined;
    if (p.bankAccountId) {
      const [b] = await db.select({ accountName: bankAccountsTable.accountName, bankName: bankAccountsTable.bankName }).from(bankAccountsTable).where(eq(bankAccountsTable.id, p.bankAccountId));
      bankAccountName = b ? `${b.bankName} – ${b.accountName}` : undefined;
    }
    return { ...p, bankAccountName };
  }));
  res.json(enriched);
});

router.post("/payments-made", requirePermission("expenses", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(paymentsMadeTable);
  const num = (count[0]?.count ?? 0) + 1;
  const paymentNumber = `PMT-${new Date().getFullYear()}-${String(num).padStart(5, "0")}`;
  const [payment] = await db.insert(paymentsMadeTable).values({ ...data, paymentNumber }).returning();
  res.status(201).json(payment);
});

router.put("/payments-made/:id", requirePermission("expenses", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(paymentsMadeTable).where(eq(paymentsMadeTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [payment] = await db.update(paymentsMadeTable).set({ ...req.body, updatedAt: new Date() }).where(eq(paymentsMadeTable.id, id)).returning();
  res.json(payment);
});

router.delete("/payments-made/:id", requirePermission("expenses", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(paymentsMadeTable).where(eq(paymentsMadeTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(paymentsMadeTable).where(eq(paymentsMadeTable.id, id));
  res.json({ success: true });
});

// Journal Entries
async function enrichJournal(j: typeof journalEntriesTable.$inferSelect) {
  const lines = await db.select().from(journalEntryLinesTable).where(eq(journalEntryLinesTable.journalId, j.id)).orderBy(journalEntryLinesTable.sortOrder);
  let preparedByName: string | undefined;
  let approvedByName: string | undefined;
  if (j.preparedById) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, j.preparedById));
    preparedByName = u?.name;
  }
  if (j.approvedById) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, j.approvedById));
    approvedByName = u?.name;
  }
  return { ...j, lines, preparedByName, approvedByName };
}

router.get("/journal-entries", requirePermission("expenses", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(journalEntriesTable).orderBy(sql`${journalEntriesTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const { companyId, status } = req.query;
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (status) rows = rows.filter(r => r.status === status);
  const enriched = await Promise.all(rows.map(enrichJournal));
  res.json(enriched);
});

router.post("/journal-entries", requirePermission("expenses", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const lines = data.lines ?? [];
  const totalDebit = lines.reduce((s: number, l: any) => s + (l.debit ?? 0), 0);
  const totalCredit = lines.reduce((s: number, l: any) => s + (l.credit ?? 0), 0);
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(journalEntriesTable);
  const num = (count[0]?.count ?? 0) + 1;
  const journalNumber = `JV-${new Date().getFullYear()}-${String(num).padStart(5, "0")}`;
  const [journal] = await db.insert(journalEntriesTable).values({ ...data, journalNumber, totalDebit, totalCredit, preparedById: req.user?.id, lines: undefined }).returning();
  if (lines.length > 0) {
    await db.insert(journalEntryLinesTable).values(lines.map((l: any, i: number) => ({ journalId: journal.id, accountId: l.accountId, accountName: l.accountName, description: l.description, debit: l.debit ?? 0, credit: l.credit ?? 0, sortOrder: i })));
  }
  res.status(201).json(await enrichJournal(journal));
});

router.get("/journal-entries/:id", requirePermission("expenses", "view"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [journal] = await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.id, id));
  if (!journal) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [journal]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(await enrichJournal(journal));
});

router.put("/journal-entries/:id", requirePermission("expenses", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  if (existing.status === "approved") { res.status(400).json({ error: "Cannot edit approved journal entry" }); return; }
  const data = req.body;
  const lines = data.lines ?? [];
  const totalDebit = lines.reduce((s: number, l: any) => s + (l.debit ?? 0), 0);
  const totalCredit = lines.reduce((s: number, l: any) => s + (l.credit ?? 0), 0);
  const [journal] = await db.update(journalEntriesTable).set({ ...data, totalDebit, totalCredit, updatedAt: new Date(), lines: undefined }).where(eq(journalEntriesTable.id, id)).returning();
  await db.delete(journalEntryLinesTable).where(eq(journalEntryLinesTable.journalId, id));
  if (lines.length > 0) {
    await db.insert(journalEntryLinesTable).values(lines.map((l: any, i: number) => ({ journalId: id, accountId: l.accountId, accountName: l.accountName, description: l.description, debit: l.debit ?? 0, credit: l.credit ?? 0, sortOrder: i })));
  }
  res.json(await enrichJournal(journal));
});

router.delete("/journal-entries/:id", requirePermission("expenses", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(journalEntryLinesTable).where(eq(journalEntryLinesTable.journalId, id));
  await db.delete(journalEntriesTable).where(eq(journalEntriesTable.id, id));
  res.json({ success: true });
});

router.post("/journal-entries/:id/approve", requirePermission("expenses", "approve"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(journalEntriesTable).where(eq(journalEntriesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [journal] = await db.update(journalEntriesTable).set({ status: "approved", approvedById: req.user?.id, updatedAt: new Date() }).where(eq(journalEntriesTable.id, id)).returning();
  res.json(await enrichJournal(journal));
});

function numberToWords(num: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  if (num === 0) return "Zero";
  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? " " + ones[num%10] : "");
  if (num < 1000) return ones[Math.floor(num/100)] + " Hundred" + (num%100 ? " " + numberToWords(num%100) : "");
  if (num < 100000) return numberToWords(Math.floor(num/1000)) + " Thousand" + (num%1000 ? " " + numberToWords(num%1000) : "");
  if (num < 10000000) return numberToWords(Math.floor(num/100000)) + " Lakh" + (num%100000 ? " " + numberToWords(num%100000) : "");
  return numberToWords(Math.floor(num/10000000)) + " Crore" + (num%10000000 ? " " + numberToWords(num%10000000) : "");
}

export default router;
