import { Router } from "express";
import { db, delegatedTasksTable, usersTable, leadsTable, notificationsTable } from "@workspace/db";
import { eq, and, or, sql } from "drizzle-orm";
import { requireAuth, requirePermissionLevel } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

async function enrichTask(task: typeof delegatedTasksTable.$inferSelect) {
  const [grantedBy] = await db.select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, task.grantedByUserId));
  const [grantedTo] = await db.select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, task.grantedToUserId));

  let leadName: string | undefined;
  let leadPreview: Record<string, unknown> | null = null;

  if (task.leadId) {
    // Fetch lead but intentionally exclude sensitive contact fields:
    // phone, whatsapp, email, companyName, contactPerson
    const [lead] = await db.select({
      id: leadsTable.id,
      leadName: leadsTable.leadName,
      requirementType: leadsTable.requirementType,
      location: leadsTable.location,
      officeAddress: leadsTable.officeAddress,
      budget: leadsTable.budget,
      quantity: leadsTable.quantity,
      notes: leadsTable.notes,
      source: leadsTable.source,
      status: leadsTable.status,
      leadScore: leadsTable.leadScore,
      companyType: leadsTable.companyType,
      website: leadsTable.website,
      licenseNumber: leadsTable.licenseNumber,
      companyId: leadsTable.companyId,
    }).from(leadsTable).where(eq(leadsTable.id, task.leadId));

    leadName = lead?.leadName;
    if (lead) leadPreview = lead as Record<string, unknown>;
  }

  return { ...task, grantedByName: grantedBy?.name, grantedToName: grantedTo?.name, leadName, leadPreview };
}

router.get("/delegated-tasks/mine", async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const now = new Date();
  const tasks = await db.select().from(delegatedTasksTable)
    .where(and(
      eq(delegatedTasksTable.grantedToUserId, userId),
      eq(delegatedTasksTable.status, "pending"),
      sql`${delegatedTasksTable.expiresAt} > ${now}`,
    ))
    .orderBy(sql`${delegatedTasksTable.createdAt} desc`);
  const enriched = await Promise.all(tasks.map(enrichTask));
  res.json(enriched);
});

router.get("/delegated-tasks", requirePermissionLevel("company_admin"), async (req, res): Promise<void> => {
  const companyScope = req.companyScope ?? null;
  let tasks = await db.select().from(delegatedTasksTable)
    .orderBy(sql`${delegatedTasksTable.createdAt} desc`);
  if (companyScope) tasks = tasks.filter(t => companyScope.includes(t.companyId));
  const enriched = await Promise.all(tasks.map(enrichTask));
  res.json(enriched);
});

router.post("/delegated-tasks", requirePermissionLevel("company_admin"), async (req, res): Promise<void> => {
  const { companyId, grantedToUserId, taskType, taskLabel, leadId, durationMinutes } = req.body;
  if (!companyId || !grantedToUserId || !taskType || !taskLabel || !durationMinutes) {
    res.status(400).json({ error: "companyId, grantedToUserId, taskType, taskLabel, durationMinutes are required" });
    return;
  }
  const dur = parseInt(durationMinutes, 10);
  if (isNaN(dur) || dur < 1 || dur > 480) {
    res.status(400).json({ error: "durationMinutes must be between 1 and 480" });
    return;
  }
  const companyScope = req.companyScope ?? null;
  if (companyScope && !companyScope.includes(parseInt(companyId, 10))) {
    res.status(403).json({ error: "Not authorized for this company" });
    return;
  }
  const now = new Date();
  const expiresAt = addMinutes(now, dur);
  const [task] = await db.insert(delegatedTasksTable).values({
    companyId: parseInt(companyId, 10),
    grantedByUserId: req.user!.id,
    grantedToUserId: parseInt(grantedToUserId, 10),
    taskType,
    taskLabel,
    leadId: leadId ? parseInt(leadId, 10) : null,
    durationMinutes: dur,
    expiresAt,
    status: "pending",
  }).returning();
  await db.insert(notificationsTable).values({
    title: "Task Delegated to You",
    message: `You have ${dur} minutes to complete: ${taskLabel}`,
    type: "warning",
    userId: parseInt(grantedToUserId, 10),
    entityType: "delegated_task",
    entityId: task.id,
    isRead: false,
  });
  const enriched = await enrichTask(task);
  res.status(201).json(enriched);
});

router.patch("/delegated-tasks/:id/complete", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = req.user!.id;
  const [task] = await db.select().from(delegatedTasksTable).where(eq(delegatedTasksTable.id, id));
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  if (task.grantedToUserId !== userId) { res.status(403).json({ error: "Not your task" }); return; }
  if (task.status !== "pending") { res.status(400).json({ error: "Task is no longer pending" }); return; }
  const [updated] = await db.update(delegatedTasksTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(delegatedTasksTable.id, id))
    .returning();
  res.json(await enrichTask(updated));
});

router.patch("/delegated-tasks/:id/revoke", requirePermissionLevel("company_admin"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const companyScope = req.companyScope ?? null;
  const [task] = await db.select().from(delegatedTasksTable).where(eq(delegatedTasksTable.id, id));
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  if (companyScope && !companyScope.includes(task.companyId)) { res.status(403).json({ error: "Not authorized" }); return; }
  const [updated] = await db.update(delegatedTasksTable)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(eq(delegatedTasksTable.id, id))
    .returning();
  res.json(await enrichTask(updated));
});

export default router;
