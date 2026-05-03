import { Router } from "express";
import { db, activitiesTable, usersTable, leadsTable, dealsTable, contactsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission, getOwnerScope, inOwnerScope, ownerScopeFilter } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

/** Resolve the companyId for an activity via its linked lead, deal, or contact. */
async function resolveCompanyId(a: typeof activitiesTable.$inferSelect): Promise<number | null> {
  if (a.leadId) {
    const [r] = await db.select({ companyId: leadsTable.companyId }).from(leadsTable).where(eq(leadsTable.id, a.leadId));
    if (r?.companyId) return r.companyId;
  }
  if (a.dealId) {
    const [r] = await db.select({ companyId: dealsTable.companyId }).from(dealsTable).where(eq(dealsTable.id, a.dealId));
    if (r?.companyId) return r.companyId;
  }
  if (a.contactId) {
    const [r] = await db.select({ companyId: contactsTable.companyId }).from(contactsTable).where(eq(contactsTable.id, a.contactId));
    if (r?.companyId) return r.companyId;
  }
  return null;
}

router.get("/activities", requirePermission("activities", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(activitiesTable).orderBy(sql`${activitiesTable.createdAt} desc`);
  const ownerScope = await getOwnerScope(req);
  rows = ownerScopeFilter(ownerScope, rows, ["createdById"]);
  const { leadId, dealId, contactId, type } = req.query;
  if (leadId) rows = rows.filter(r => r.leadId === parseInt(leadId as string, 10));
  if (dealId) rows = rows.filter(r => r.dealId === parseInt(dealId as string, 10));
  if (contactId) rows = rows.filter(r => r.contactId === parseInt(contactId as string, 10));
  if (type) rows = rows.filter(r => r.type === type);

  const enriched = await Promise.all(rows.map(async (a) => {
    const [companyId, user] = await Promise.all([
      resolveCompanyId(a),
      a.createdById
        ? db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, a.createdById)).then(r => r[0])
        : Promise.resolve(undefined),
    ]);
    return { ...a, createdByName: user?.name, _companyId: companyId };
  }));

  // Tenant isolation: filter by caller's company scope using the resolved companyId.
  const scope = req.companyScope;
  const filtered = enriched
    .filter(r => {
      if (scope === null || scope === undefined) return true;
      return r._companyId == null || scope.includes(r._companyId);
    })
    .map(({ _companyId, ...r }) => r);

  res.json(filtered);
});

router.post("/activities", requirePermission("activities", "create"), async (req, res): Promise<void> => {
  // Tenant isolation: verify the referenced lead/deal/contact belongs to the caller's scope.
  const scope = req.companyScope;
  if (scope !== null && scope !== undefined) {
    const tmpRow = { leadId: req.body?.leadId ?? null, dealId: req.body?.dealId ?? null, contactId: req.body?.contactId ?? null } as typeof activitiesTable.$inferSelect;
    const cid = await resolveCompanyId(tmpRow);
    if (cid != null && !scope.includes(cid)) {
      res.status(403).json({ error: "Forbidden", message: "Referenced entity belongs to a company outside your scope" });
      return;
    }
  }
  const [activity] = await db.insert(activitiesTable).values({
    ...req.body,
    createdById: req.user?.id,
  }).returning();
  res.status(201).json(activity);
});

router.put("/activities/:id", requirePermission("activities", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(activitiesTable).where(eq(activitiesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const ownerScope = await getOwnerScope(req);
  if (!inOwnerScope(ownerScope, existing.createdById)) { res.status(403).json({ error: "Forbidden" }); return; }
  // Scope check before allowing mutation.
  const scope = req.companyScope;
  if (scope !== null && scope !== undefined) {
    const cid = await resolveCompanyId(existing);
    if (cid != null && !scope.includes(cid)) {
      res.status(403).json({ error: "Forbidden", message: "Activity belongs to a company outside your scope" });
      return;
    }
  }
  const [activity] = await db.update(activitiesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(activitiesTable.id, id)).returning();
  res.json(activity);
});

router.delete("/activities/:id", requirePermission("activities", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(activitiesTable).where(eq(activitiesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const ownerScope = await getOwnerScope(req);
  if (!inOwnerScope(ownerScope, existing.createdById)) { res.status(403).json({ error: "Forbidden" }); return; }
  const scope = req.companyScope;
  if (scope !== null && scope !== undefined) {
    const cid = await resolveCompanyId(existing);
    if (cid != null && !scope.includes(cid)) {
      res.status(403).json({ error: "Forbidden", message: "Activity belongs to a company outside your scope" });
      return;
    }
  }
  await db.delete(activitiesTable).where(eq(activitiesTable.id, id));
  res.json({ success: true });
});

export default router;
