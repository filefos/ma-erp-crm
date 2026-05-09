import { Router, Request } from "express";
import { db, dealsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, inScope } from "../middlewares/auth";
import { validateBody } from "../middlewares/validate";
import { CreateDealBody, UpdateDealBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

/**
 * Resolves the companyId from the request body, falling back to the user's
 * active company scope when not supplied. Returns undefined when the scope is
 * ambiguous (multi-company super_admin with no explicit companyId provided).
 * Rejects with 400 if the resolved id is outside the caller's scope.
 */
function resolveCompanyId(req: Request, bodyCompanyId: number | undefined): { companyId: number } | { error: string; status: number } {
  if (bodyCompanyId != null) {
    if (!inScope(req, bodyCompanyId)) {
      return { error: "You do not have access to that company", status: 403 };
    }
    return { companyId: bodyCompanyId };
  }
  // Fall back to the caller's active/only company scope.
  const scope = req.companyScope as number[] | null;
  if (scope !== null && scope !== undefined && scope.length === 1) {
    return { companyId: scope[0] };
  }
  return { error: "companyId is required — provide it explicitly or select a single active company", status: 400 };
}

async function enrichDeal(deal: typeof dealsTable.$inferSelect) {
  let assignedToName: string | undefined;
  if (deal.assignedToId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, deal.assignedToId));
    assignedToName = u?.name;
  }
  return { ...deal, assignedToName };
}

router.get("/deals", requirePermission("deals", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(dealsTable).orderBy(sql`${dealsTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const { stage, companyId, assignedToId, leadId } = req.query;
  if (stage) rows = rows.filter(r => r.stage === stage);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (assignedToId) rows = rows.filter(r => r.assignedToId === parseInt(assignedToId as string, 10));
  if (leadId) rows = rows.filter(r => r.leadId === parseInt(leadId as string, 10));
  const enriched = await Promise.all(rows.map(enrichDeal));
  res.json(enriched);
});

router.post("/deals", requirePermission("deals", "create"), validateBody(CreateDealBody), async (req, res): Promise<void> => {
  const data = req.body;
  const resolved = resolveCompanyId(req, data.companyId);
  if ("error" in resolved) { res.status(resolved.status).json({ error: resolved.error }); return; }
  const { companyId } = resolved;

  const count = await db.select({ count: sql<number>`count(*)::int` }).from(dealsTable);
  const num = (count[0]?.count ?? 0) + 1;
  const year = new Date().getFullYear();
  const dealNumber = `DEAL-${year}-${String(num).padStart(4, "0")}`;
  const [deal] = await db.insert(dealsTable).values({
    dealNumber,
    title: data.title,
    clientName: data.clientName,
    value: data.value,
    stage: data.stage ?? "prospecting",
    probability: data.probability,
    expectedCloseDate: data.expectedCloseDate,
    assignedToId: data.assignedToId ?? req.user?.id,
    companyId,
    leadId: data.leadId,
    notes: data.notes,
    createdById: req.user?.id,
  }).returning();
  res.status(201).json(await enrichDeal(deal!));
});

router.put("/deals/:id", requirePermission("deals", "edit"), validateBody(UpdateDealBody), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(dealsTable).where(eq(dealsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }

  // If caller is changing companyId, verify the new value is in scope.
  const data = req.body;
  if (data.companyId != null && !inScope(req, data.companyId)) {
    res.status(403).json({ error: "You do not have access to that company" });
    return;
  }
  // Never allow setting companyId to null on an update — preserve existing value.
  const companyId = data.companyId ?? existing.companyId;
  if (!companyId) {
    res.status(400).json({ error: "Deal has no company scope — companyId is required" });
    return;
  }

  const { title, clientName, value, stage, probability, expectedCloseDate, assignedToId, leadId, notes } = data;
  const [deal] = await db.update(dealsTable).set({
    title, clientName, value, stage, probability, expectedCloseDate,
    assignedToId, companyId, leadId, notes, updatedAt: new Date(),
  }).where(eq(dealsTable.id, id)).returning();
  res.json(await enrichDeal(deal!));
});

router.delete("/deals/:id", requirePermission("deals", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(dealsTable).where(eq(dealsTable.id, id));
  if (existing && !scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(dealsTable).where(eq(dealsTable.id, id));
  res.json({ success: true });
});

export default router;
