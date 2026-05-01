import { Router } from "express";
import { db, notificationsTable, auditLogsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

// Notifications
router.get("/notifications", async (req, res): Promise<void> => {
  const userId = req.user!.id;
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
  await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, id));
  res.json({ success: true });
});

router.post("/notifications/read-all", async (req, res): Promise<void> => {
  const userId = req.user!.id;
  await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.userId, userId));
  res.json({ success: true });
});

// Audit Logs
router.get("/audit-logs", async (req, res): Promise<void> => {
  let rows = await db.select().from(auditLogsTable).orderBy(sql`${auditLogsTable.createdAt} desc`);
  const { userId, action, entity, limit } = req.query;
  if (userId) rows = rows.filter(r => r.userId === parseInt(userId as string, 10));
  if (action) rows = rows.filter(r => r.action === action);
  if (entity) rows = rows.filter(r => r.entity === entity);
  const lim = limit ? parseInt(limit as string, 10) : 100;
  res.json(rows.slice(0, lim));
});

export default router;
