import { Router } from "express";
import { db, contactsTable, leadsTable } from "@workspace/db";
import { eq, sql, inArray } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess, getOwnerScope } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

/** For restricted scopes, return the set of `companyName` values from leads the user owns. */
async function ownedClientNames(scope: { kind: "all" } | { kind: "users"; userIds: Set<number> }): Promise<Set<string> | null> {
  if (scope.kind === "all") return null;
  const ids = Array.from(scope.userIds);
  if (ids.length === 0) return new Set();
  const ownLeads = await db
    .select({ companyName: leadsTable.companyName })
    .from(leadsTable)
    .where(inArray(leadsTable.assignedToId, ids));
  const names = new Set<string>();
  for (const l of ownLeads) {
    const n = (l.companyName ?? "").trim().toLowerCase();
    if (n) names.add(n);
  }
  return names;
}

router.get("/contacts", requirePermission("contacts", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(contactsTable).orderBy(contactsTable.name);
  rows = scopeFilter(req, rows);
  const ownerScope = await getOwnerScope(req);
  const allowedNames = await ownedClientNames(ownerScope);
  if (allowedNames !== null) {
    rows = rows.filter(r => {
      const n = (r.companyName ?? "").trim().toLowerCase();
      return n !== "" && allowedNames.has(n);
    });
  }
  const { search, companyId } = req.query;
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (search) {
    const s = (search as string).toLowerCase();
    rows = rows.filter(r => r.name.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s) || r.companyName?.toLowerCase().includes(s));
  }
  res.json(rows);
});

router.post("/contacts", requirePermission("contacts", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const [contact] = await db.insert(contactsTable).values(req.body).returning();
  res.status(201).json(contact);
});

function contactInOwnerNames(contact: { companyName: string | null }, allowedNames: Set<string> | null): boolean {
  if (allowedNames === null) return true;
  const n = (contact.companyName ?? "").trim().toLowerCase();
  return n !== "" && allowedNames.has(n);
}

router.get("/contacts/:id", requirePermission("contacts", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
  if (!contact) { res.status(404).json({ error: "Not found" }); return; }
  if (contact.companyId != null && !scopeFilter(req, [contact]).length) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const ownerScope = await getOwnerScope(req);
  const allowedNames = await ownedClientNames(ownerScope);
  if (!contactInOwnerNames(contact, allowedNames)) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(contact);
});

router.put("/contacts/:id", requirePermission("contacts", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const ownerScope = await getOwnerScope(req);
  const allowedNames = await ownedClientNames(ownerScope);
  if (!contactInOwnerNames(existing, allowedNames)) { res.status(403).json({ error: "Forbidden" }); return; }
  const [contact] = await db.update(contactsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(contactsTable.id, id)).returning();
  res.json(contact);
});

router.delete("/contacts/:id", requirePermission("contacts", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
  if (existing && !scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  if (existing) {
    const ownerScope = await getOwnerScope(req);
    const allowedNames = await ownedClientNames(ownerScope);
    if (!contactInOwnerNames(existing, allowedNames)) { res.status(403).json({ error: "Forbidden" }); return; }
  }
  await db.delete(contactsTable).where(eq(contactsTable.id, id));
  res.json({ success: true });
});

export default router;
