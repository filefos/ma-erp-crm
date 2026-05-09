import { Router } from "express";
import { db, contactsTable, quotationsTable, lposTable, proformaInvoicesTable, taxInvoicesTable, deliveryNotesTable, undertakingLettersTable, handoverNotesTable, paymentsReceivedTable } from "@workspace/db";
import { eq, inArray, or, ilike, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess, getOwnerScope, ownerScopeFilter } from "../middlewares/auth";
import { genClientCode, findDuplicateContact } from "../lib/client-code";

const router = Router();
router.use(requireAuth);

// Pre-create dedupe check used by the UI before opening the conversion form.
// Scoped strictly to the caller's accessible companies — no cross-company probing.
router.get("/contacts/check-duplicate", requirePermission("contacts", "view"), async (req, res): Promise<void> => {
  const phone = (req.query.phone as string | undefined) ?? null;
  const email = (req.query.email as string | undefined) ?? null;
  const requestedCompanyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;
  if (!requestedCompanyId) {
    res.status(400).json({ error: "companyId is required" });
    return;
  }
  // companyScope === null means admin (all companies allowed); otherwise must be in scope.
  const scope = req.companyScope;
  if (scope !== null && scope !== undefined && !scope.includes(requestedCompanyId)) {
    res.status(403).json({ error: "companyId not in your scope" });
    return;
  }
  const dup = await findDuplicateContact(requestedCompanyId, phone, email);
  res.json({ duplicate: dup ?? null });
});


router.get("/contacts", requirePermission("contacts", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(contactsTable).orderBy(contactsTable.name);
  // Company-scope filter, then per-user isolation.
  // Non-admin users see only contacts they created; admins see all.
  rows = scopeFilter(req, rows);
  const ownerScope = await getOwnerScope(req);
  rows = ownerScopeFilter(ownerScope, rows, ["createdById"]);
  const { search, companyId } = req.query;
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (search) {
    const s = (search as string).toLowerCase();
    rows = rows.filter(r => r.name.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s) || r.companyName?.toLowerCase().includes(s));
  }
  res.json(rows);
});

router.post("/contacts", requirePermission("contacts", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const dup = await findDuplicateContact(req.body.companyId ?? null, req.body.phone, req.body.email);
  if (dup) {
    res.status(409).json({
      error: "Contact already exists",
      message: `A contact with this ${dup.phone === req.body.phone ? "phone" : "email"} already exists.`,
      existingContactId: dup.id,
      existingContact: dup,
    });
    return;
  }
  const data: any = { ...req.body, createdById: req.user?.id };
  if (req.body.companyId && !data.clientCode) {
    data.clientCode = await genClientCode(req.body.companyId);
  }
  const [contact] = await db.insert(contactsTable).values(data).returning();
  res.status(201).json(contact);
});

router.get("/contacts/:id", requirePermission("contacts", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
  if (!contact) { res.status(404).json({ error: "Not found" }); return; }
  if (contact.companyId != null && !scopeFilter(req, [contact]).length) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  res.json(contact);
});

router.put("/contacts/:id", requirePermission("contacts", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [contact] = await db.update(contactsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(contactsTable.id, id)).returning();
  res.json(contact);
});

router.delete("/contacts/:id", requirePermission("contacts", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
  if (existing && !scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(contactsTable).where(eq(contactsTable.id, id));
  res.json({ success: true });
});

router.delete("/contacts", requirePermission("contacts", "delete"), async (req, res): Promise<void> => {
  const raw = req.body?.ids;
  if (!Array.isArray(raw) || raw.length === 0) {
    res.status(400).json({ error: "ids array required" });
    return;
  }
  const ids = raw.map(Number).filter(n => Number.isFinite(n));
  if (ids.length === 0) { res.status(400).json({ error: "No valid ids" }); return; }
  const rows = await db.select().from(contactsTable).where(inArray(contactsTable.id, ids));
  const allowed = scopeFilter(req, rows).map(r => r.id);
  if (allowed.length === 0) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(contactsTable).where(inArray(contactsTable.id, allowed));
  res.json({ deleted: allowed.length });
});

// ── Customer 360 — all documents for a contact ────────────────────────────────
router.get("/contacts/:id/documents", requirePermission("contacts", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
  if (!contact) { res.status(404).json({ error: "Not found" }); return; }
  if (contact.companyId != null && !scopeFilter(req, [contact]).length) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const code = contact.clientCode;
  const namePat = `%${contact.name}%`;

  const matchQ = (tbl: typeof quotationsTable) =>
    code ? or(ilike(tbl.clientCode, code), ilike(tbl.clientName, namePat))! : ilike(tbl.clientName, namePat);
  const matchL = (tbl: typeof lposTable) =>
    code ? or(ilike(tbl.clientCode, code), ilike(tbl.clientName, namePat))! : ilike(tbl.clientName, namePat);
  const matchP = (tbl: typeof proformaInvoicesTable) =>
    code ? or(ilike(tbl.clientCode, code), ilike(tbl.clientName, namePat))! : ilike(tbl.clientName, namePat);
  const matchI = (tbl: typeof taxInvoicesTable) =>
    code ? or(ilike(tbl.clientCode, code), ilike(tbl.clientName, namePat))! : ilike(tbl.clientName, namePat);
  const matchD = (tbl: typeof deliveryNotesTable) =>
    ilike(tbl.clientName, namePat);
  const matchUL = (tbl: typeof undertakingLettersTable) =>
    ilike(tbl.clientName, namePat);
  const matchHON = (tbl: typeof handoverNotesTable) =>
    ilike(tbl.clientName, namePat);
  const matchPmt = (tbl: typeof paymentsReceivedTable) =>
    ilike(tbl.customerName, namePat);

  const [quotations, lpos, proformas, invoices, deliveryNotes, undertakingLetters, handoverNotes, payments] = await Promise.all([
    db.select().from(quotationsTable).where(matchQ(quotationsTable)).orderBy(sql`${quotationsTable.createdAt} desc`).limit(100),
    db.select().from(lposTable).where(matchL(lposTable)).orderBy(sql`${lposTable.createdAt} desc`).limit(100),
    db.select().from(proformaInvoicesTable).where(matchP(proformaInvoicesTable)).orderBy(sql`${proformaInvoicesTable.createdAt} desc`).limit(100),
    db.select().from(taxInvoicesTable).where(matchI(taxInvoicesTable)).orderBy(sql`${taxInvoicesTable.createdAt} desc`).limit(100),
    db.select().from(deliveryNotesTable).where(matchD(deliveryNotesTable)).orderBy(sql`${deliveryNotesTable.createdAt} desc`).limit(100),
    db.select().from(undertakingLettersTable).where(matchUL(undertakingLettersTable)).orderBy(sql`${undertakingLettersTable.createdAt} desc`).limit(100),
    db.select().from(handoverNotesTable).where(matchHON(handoverNotesTable)).orderBy(sql`${handoverNotesTable.createdAt} desc`).limit(100),
    db.select().from(paymentsReceivedTable).where(matchPmt(paymentsReceivedTable)).orderBy(sql`${paymentsReceivedTable.createdAt} desc`).limit(100),
  ]);

  const scopedQuotations = scopeFilter(req, quotations);
  const scopedLpos = scopeFilter(req, lpos);
  const scopedProformas = scopeFilter(req, proformas);
  const scopedInvoices = scopeFilter(req, invoices);
  const scopedDns = scopeFilter(req, deliveryNotes);
  const scopedUls = scopeFilter(req, undertakingLetters);
  const scopedHons = scopeFilter(req, handoverNotes);
  const scopedPayments = scopeFilter(req, payments);

  const totalInvoiced = scopedInvoices.reduce((s, i) => s + Number((i as any).grandTotal ?? 0), 0);
  const totalPaid = scopedPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const outstandingBalance = Math.max(0, totalInvoiced - totalPaid);

  res.json({
    contact,
    quotations: scopedQuotations,
    lpos: scopedLpos,
    proformas: scopedProformas,
    invoices: scopedInvoices,
    deliveryNotes: scopedDns,
    undertakingLetters: scopedUls,
    handoverNotes: scopedHons,
    payments: scopedPayments,
    summary: {
      quotationCount: scopedQuotations.length,
      lpoCount: scopedLpos.length,
      invoiceCount: scopedInvoices.length,
      deliveryCount: scopedDns.length,
      undertakingCount: scopedUls.length,
      handoverCount: scopedHons.length,
      paymentCount: scopedPayments.length,
      totalInvoiced,
      totalPaid,
      outstandingBalance,
    },
  });
});

export default router;
