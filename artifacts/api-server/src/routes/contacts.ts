import { Router } from "express";
import { db, contactsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess } from "../middlewares/auth";
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
  // Company-scope filter: restrict to companies the caller can access.
  // We intentionally do NOT apply the ownerScope/lead-name filter here —
  // contacts are a shared directory; filtering by "leads you own" hides
  // freshly created contacts and makes the panel appear broken.
  rows = scopeFilter(req, rows);
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

export default router;
