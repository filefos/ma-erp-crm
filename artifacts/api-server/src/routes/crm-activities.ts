import { Router, Request } from "express";
import { db, crmActivitiesTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, inScope } from "../middlewares/auth";
import { validateBody } from "../middlewares/validate";
import { CreateActivityBody, UpdateActivityBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

/**
 * Resolves the companyId from the request body, falling back to the user's
 * active company scope when not supplied. Rejects if scope is ambiguous or
 * out of range.
 */
function resolveCompanyId(req: Request, bodyCompanyId: number | undefined): { companyId: number } | { error: string; status: number } {
  if (bodyCompanyId != null) {
    if (!inScope(req, bodyCompanyId)) {
      return { error: "You do not have access to that company", status: 403 };
    }
    return { companyId: bodyCompanyId };
  }
  const scope = req.companyScope as number[] | null;
  if (scope !== null && scope !== undefined && scope.length === 1) {
    return { companyId: scope[0] };
  }
  return { error: "companyId is required — provide it explicitly or select a single active company", status: 400 };
}

async function enrichActivity(activity: typeof crmActivitiesTable.$inferSelect) {
  let createdByName: string | undefined;
  if (activity.createdById) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, activity.createdById));
    createdByName = u?.name;
  }
  return { ...activity, createdByName };
}

router.get("/activities", requirePermission("activities", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(crmActivitiesTable).orderBy(sql`${crmActivitiesTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const { type, leadId, dealId, contactId, isDone } = req.query;
  if (type) rows = rows.filter(r => r.type === type);
  if (leadId) rows = rows.filter(r => r.leadId === parseInt(leadId as string, 10));
  if (dealId) rows = rows.filter(r => r.dealId === parseInt(dealId as string, 10));
  if (contactId) rows = rows.filter(r => r.contactId === parseInt(contactId as string, 10));
  if (isDone !== undefined) {
    const done = isDone === "true" || isDone === "1";
    rows = rows.filter(r => r.isDone === done);
  }
  const enriched = await Promise.all(rows.map(enrichActivity));
  res.json(enriched);
});

router.post("/activities", requirePermission("activities", "create"), validateBody(CreateActivityBody), async (req, res): Promise<void> => {
  const data = req.body;
  const resolved = resolveCompanyId(req, data.companyId);
  if ("error" in resolved) { res.status(resolved.status).json({ error: resolved.error }); return; }
  const { companyId } = resolved;

  const [activity] = await db.insert(crmActivitiesTable).values({
    type: data.type,
    subject: data.subject,
    description: data.description,
    dueDate: data.dueDate,
    isDone: data.isDone ?? false,
    leadId: data.leadId,
    dealId: data.dealId,
    contactId: data.contactId,
    companyId,
    createdById: req.user?.id,
  }).returning();
  res.status(201).json(await enrichActivity(activity!));
});

router.put("/activities/:id", requirePermission("activities", "edit"), validateBody(UpdateActivityBody), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(crmActivitiesTable).where(eq(crmActivitiesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }

  const data = req.body;
  // If caller is changing companyId, verify it's in scope.
  if (data.companyId != null && !inScope(req, data.companyId)) {
    res.status(403).json({ error: "You do not have access to that company" });
    return;
  }
  // Never allow setting companyId to null — preserve the existing scoped value.
  const companyId = data.companyId ?? existing.companyId;
  if (!companyId) {
    res.status(400).json({ error: "Activity has no company scope — companyId is required" });
    return;
  }

  const { type, subject, description, dueDate, isDone, leadId, dealId, contactId } = data;
  const [activity] = await db.update(crmActivitiesTable).set({
    type, subject, description, dueDate, isDone, leadId, dealId, contactId,
    companyId, updatedAt: new Date(),
  }).where(eq(crmActivitiesTable.id, id)).returning();
  res.json(await enrichActivity(activity!));
});

router.delete("/activities/:id", requirePermission("activities", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(crmActivitiesTable).where(eq(crmActivitiesTable.id, id));
  if (existing && !scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(crmActivitiesTable).where(eq(crmActivitiesTable.id, id));
  res.json({ success: true });
});

export default router;
