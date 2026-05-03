import { Router } from "express";
import { db, notificationsTable, auditLogsTable, leadsTable, deviceTokensTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { requireAuth, requirePermissionLevel } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

async function autoCheckFollowUps(userId: number, companyScope: number[] | null) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const dueLeads = await db.select().from(leadsTable)
      .where(and(eq(leadsTable.isActive, true), sql`${leadsTable.nextFollowUp} IS NOT NULL AND ${leadsTable.nextFollowUp} <= ${today}`));
    const active = dueLeads.filter(l => {
      if (!["won", "lost"].includes(l.status)) {
        // Only process leads within the caller's company scope
        if (companyScope === null) return true;
        return l.companyId == null || companyScope.includes(l.companyId as number);
      }
      return false;
    });
    for (const lead of active) {
      const notifyUsers = new Set<number>();
      if (lead.assignedToId) notifyUsers.add(lead.assignedToId);
      notifyUsers.add(userId);
      for (const uid of notifyUsers) {
        const [existing] = await db.select({ count: sql<number>`count(*)::int` })
          .from(notificationsTable)
          .where(and(
            eq(notificationsTable.userId, uid),
            eq(notificationsTable.entityType, "lead"),
            eq(notificationsTable.entityId, lead.id),
            sql`DATE(${notificationsTable.createdAt}) = CURRENT_DATE`,
          ));
        if ((existing?.count ?? 0) === 0) {
          const isOverdue = lead.nextFollowUp! < today;
          await db.insert(notificationsTable).values({
            title: isOverdue ? "Overdue Follow-up!" : "Follow-up Due Today",
            message: `${isOverdue ? "OVERDUE: " : ""}Follow-up for "${lead.leadName}" (${lead.companyName ?? "Unknown"})${lead.requirementType ? ` — ${lead.requirementType}` : ""}`,
            type: isOverdue ? "warning" : "info",
            userId: uid,
            entityType: "lead",
            entityId: lead.id,
            isRead: false,
          });
        }
      }
    }
  } catch { /* non-critical */ }
}

// Notifications
router.get("/notifications", async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const companyScope = req.companyScope ?? null;
  // Background: auto-create follow-up notifications for due leads within scope
  autoCheckFollowUps(userId, companyScope);
  let rows = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(sql`${notificationsTable.createdAt} desc`)
    .limit(50);
  const { unreadOnly } = req.query;
  if (unreadOnly === "true") rows = rows.filter(r => !r.isRead);
  res.json(rows);
});

router.post("/notifications/:id/read", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = req.user!.id;
  const result = await db.update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)))
    .returning();
  if (!result.length) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true });
});

router.post("/notifications/read-all", async (req, res): Promise<void> => {
  const userId = req.user!.id;
  await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.userId, userId));
  res.json({ success: true });
});

// Device tokens for Expo push notifications. Tokens are upserted by token
// value so the same physical device that re-installs / re-registers replaces
// the prior row instead of accumulating dead entries.
router.post("/device-tokens", async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const platform = typeof req.body?.platform === "string" ? req.body.platform : null;
  const deviceName = typeof req.body?.deviceName === "string" ? req.body.deviceName : null;
  if (!token || !/^Expo(nent)?PushToken\[[^\]]+\]$/.test(token)) {
    res.status(400).json({ error: "Invalid Expo push token" });
    return;
  }
  const now = new Date();
  const [existing] = await db.select().from(deviceTokensTable).where(eq(deviceTokensTable.token, token));
  if (existing) {
    const [updated] = await db.update(deviceTokensTable).set({
      userId,
      platform: platform ?? existing.platform,
      deviceName: deviceName ?? existing.deviceName,
      isActive: true,
      lastSeenAt: now,
    }).where(eq(deviceTokensTable.id, existing.id)).returning();
    res.json(updated);
    return;
  }
  const [created] = await db.insert(deviceTokensTable).values({
    userId, token, platform, deviceName, isActive: true,
  }).returning();
  res.status(201).json(created);
});

router.delete("/device-tokens", async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  if (!token) { res.status(400).json({ error: "token required" }); return; }
  await db.update(deviceTokensTable)
    .set({ isActive: false })
    .where(and(eq(deviceTokensTable.userId, userId), eq(deviceTokensTable.token, token)));
  res.json({ success: true });
});

// Audit Logs (admin only)
// audit_logs has no company_id column, so only super_admin can read them
// to avoid cross-tenant activity leakage.
router.get("/audit-logs", requirePermissionLevel("super_admin"), async (req, res): Promise<void> => {
  let rows = await db.select().from(auditLogsTable).orderBy(sql`${auditLogsTable.createdAt} desc`);
  const { userId, action, entity, limit } = req.query;
  if (userId) rows = rows.filter(r => r.userId === parseInt(userId as string, 10));
  if (action) rows = rows.filter(r => r.action === action);
  if (entity) rows = rows.filter(r => r.entity === entity);
  const lim = limit ? parseInt(limit as string, 10) : 100;
  res.json(rows.slice(0, lim));
});

export default router;
