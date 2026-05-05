import { Router } from "express";
import { eq, and, gte, lte, desc, sql, isNull } from "drizzle-orm";
import { db, userActivitySessionsTable, usersTable, companiesTable, auditLogsTable } from "@workspace/db";
import { requireAuth, requirePermissionLevel } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

// ── Unique User ID helper ────────────────────────────────────────────────────

function getModuleCode(role: string): string {
  const r = (role ?? "").toLowerCase();
  if (r.includes("account") || r.includes("financ")) return "AC";
  if (r.includes("sale")) return "SA";
  if (r.includes("crm") || r.includes("lead") || r.includes("contact")) return "CR";
  if (r.includes("procure") || r.includes("purchas")) return "PR";
  if (r.includes("inventor") || r.includes("warehouse")) return "IN";
  if (r.includes("project")) return "PJ";
  if (r.includes("hr") || r.includes("human")) return "HR";
  if (r.includes("asset")) return "AS";
  return "AD";
}

async function getOrGenUniqueUserId(userId: number, companyId: number | null | undefined, role: string): Promise<string | null> {
  const [user] = await db.select({ uniqueUserId: usersTable.uniqueUserId }).from(usersTable).where(eq(usersTable.id, userId));
  if (user?.uniqueUserId) return user.uniqueUserId;
  if (!companyId) return null;
  const [co] = await db.select({ prefix: companiesTable.prefix }).from(companiesTable).where(eq(companiesTable.id, companyId));
  const prefix = (co?.prefix ?? "PM").toUpperCase();
  const moduleCode = getModuleCode(role);
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const result: any = await db.execute(sql`SELECT nextval('unique_user_id_seq') AS n`);
  const row = Array.isArray(result) ? result[0] : (result?.rows?.[0] ?? result?.[0]);
  const n = Number(row?.n ?? 1);
  const uid = `${prefix}${moduleCode}-${yy}${mm}-${String(n).padStart(4, "0")}`;
  await db.update(usersTable).set({ uniqueUserId: uid } as any).where(eq(usersTable.id, userId));
  return uid;
}

// ── Session Start ────────────────────────────────────────────────────────────

router.post("/activity/session/start", async (req, res): Promise<void> => {
  const u = req.user!;
  const { sessionKey } = req.body as { sessionKey?: string };
  if (!sessionKey) { res.status(400).json({ error: "sessionKey required" }); return; }

  const uniqueUserId = await getOrGenUniqueUserId(u.id, u.companyId, u.role ?? "");

  try {
    const [session] = await db.insert(userActivitySessionsTable).values({
      userId: u.id,
      companyId: u.companyId ?? null,
      uniqueUserId,
      sessionKey,
      ipAddress: (() => {
        const fwd = req.headers["x-forwarded-for"];
        if (typeof fwd === "string") return fwd.split(",")[0]!.trim();
        return req.ip ?? null;
      })(),
      userAgent: req.headers["user-agent"] ?? null,
      loginAt: new Date(),
    }).returning();
    res.json({ id: session.id, uniqueUserId });
  } catch {
    // Duplicate session key → idempotent (already started)
    const [existing] = await db.select().from(userActivitySessionsTable)
      .where(eq(userActivitySessionsTable.sessionKey, sessionKey));
    if (existing) { res.json({ id: existing.id, uniqueUserId }); return; }
    res.status(500).json({ error: "Failed to start session" });
  }
});

// ── Heartbeat ────────────────────────────────────────────────────────────────

router.post("/activity/heartbeat", async (req, res): Promise<void> => {
  const { sessionKey, activeSeconds, idleSeconds, focusLostCount } = req.body as {
    sessionKey?: string; activeSeconds?: number; idleSeconds?: number; focusLostCount?: number;
  };
  if (!sessionKey) { res.status(400).json({ error: "sessionKey required" }); return; }

  await db.update(userActivitySessionsTable)
    .set({
      activeSeconds: activeSeconds ?? 0,
      idleSeconds: idleSeconds ?? 0,
      focusLostCount: focusLostCount ?? 0,
      lastHeartbeatAt: new Date(),
    })
    .where(
      and(
        eq(userActivitySessionsTable.sessionKey, sessionKey),
        eq(userActivitySessionsTable.userId, req.user!.id),
        isNull(userActivitySessionsTable.logoutAt),
      ),
    );
  res.json({ ok: true });
});

// ── Session End ───────────────────────────────────────────────────────────────

router.post("/activity/session/end", async (req, res): Promise<void> => {
  const { sessionKey, activeSeconds, idleSeconds, focusLostCount } = req.body as {
    sessionKey?: string; activeSeconds?: number; idleSeconds?: number; focusLostCount?: number;
  };
  if (!sessionKey) { res.status(400).json({ error: "sessionKey required" }); return; }

  await db.update(userActivitySessionsTable)
    .set({
      logoutAt: new Date(),
      lastHeartbeatAt: new Date(),
      activeSeconds: activeSeconds ?? 0,
      idleSeconds: idleSeconds ?? 0,
      focusLostCount: focusLostCount ?? 0,
    })
    .where(
      and(
        eq(userActivitySessionsTable.sessionKey, sessionKey),
        eq(userActivitySessionsTable.userId, req.user!.id),
        isNull(userActivitySessionsTable.logoutAt),
      ),
    );
  res.json({ ok: true });
});

// ── Admin: list sessions ─────────────────────────────────────────────────────

router.get("/activity/sessions", requirePermissionLevel("super_admin"), async (req, res): Promise<void> => {
  const { userId, from, to, month, year } = req.query as Record<string, string>;

  const conds: any[] = [];
  if (userId) conds.push(eq(userActivitySessionsTable.userId, parseInt(userId, 10)));

  if (from) conds.push(gte(userActivitySessionsTable.loginAt, new Date(from)));
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    conds.push(lte(userActivitySessionsTable.loginAt, toDate));
  }
  if (month && year) {
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    conds.push(gte(userActivitySessionsTable.loginAt, start));
    conds.push(lte(userActivitySessionsTable.loginAt, end));
  } else if (year) {
    const y = parseInt(year, 10);
    conds.push(gte(userActivitySessionsTable.loginAt, new Date(y, 0, 1)));
    conds.push(lte(userActivitySessionsTable.loginAt, new Date(y, 11, 31, 23, 59, 59, 999)));
  }

  const rows = await db
    .select({
      id: userActivitySessionsTable.id,
      userId: userActivitySessionsTable.userId,
      userName: usersTable.name,
      userRole: usersTable.role,
      uniqueUserId: userActivitySessionsTable.uniqueUserId,
      companyId: userActivitySessionsTable.companyId,
      loginAt: userActivitySessionsTable.loginAt,
      logoutAt: userActivitySessionsTable.logoutAt,
      lastHeartbeatAt: userActivitySessionsTable.lastHeartbeatAt,
      activeSeconds: userActivitySessionsTable.activeSeconds,
      idleSeconds: userActivitySessionsTable.idleSeconds,
      focusLostCount: userActivitySessionsTable.focusLostCount,
      ipAddress: userActivitySessionsTable.ipAddress,
    })
    .from(userActivitySessionsTable)
    .leftJoin(usersTable, eq(userActivitySessionsTable.userId, usersTable.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(userActivitySessionsTable.loginAt))
    .limit(500);

  const sessions = rows.map(r => {
    const totalSeconds = r.activeSeconds + r.idleSeconds;
    const efficiency = totalSeconds > 0 ? Math.round((r.activeSeconds / totalSeconds) * 100) : 0;
    const sessionMinutes = r.logoutAt
      ? Math.round((r.logoutAt.getTime() - r.loginAt.getTime()) / 60000)
      : r.lastHeartbeatAt
        ? Math.round((r.lastHeartbeatAt.getTime() - r.loginAt.getTime()) / 60000)
        : null;
    return { ...r, totalSeconds, efficiency, sessionMinutes };
  });

  res.json(sessions);
});

// ── Admin: user detail (sessions + module activity) ──────────────────────────

router.get("/activity/users/:id/detail", requirePermissionLevel("super_admin"), async (req, res): Promise<void> => {
  const uid = parseInt(req.params.id as string, 10);

  const [user] = await db.select({
    id: usersTable.id, name: usersTable.name, email: usersTable.email,
    role: usersTable.role, companyId: usersTable.companyId,
    uniqueUserId: usersTable.uniqueUserId, userCode: usersTable.userCode,
    lastLoginAt: usersTable.lastLoginAt,
  }).from(usersTable).where(eq(usersTable.id, uid));

  if (!user) { res.status(404).json({ error: "Not found" }); return; }

  const sessions = await db.select()
    .from(userActivitySessionsTable)
    .where(eq(userActivitySessionsTable.userId, uid))
    .orderBy(desc(userActivitySessionsTable.loginAt))
    .limit(50);

  const moduleLogs = await db.select({
    entity: auditLogsTable.entity,
    action: auditLogsTable.action,
    createdAt: auditLogsTable.createdAt,
    details: auditLogsTable.details,
  })
    .from(auditLogsTable)
    .where(eq(auditLogsTable.userId, uid))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(200);

  const moduleBreakdown: Record<string, number> = {};
  for (const log of moduleLogs) {
    if (!log.entity) continue;
    moduleBreakdown[log.entity] = (moduleBreakdown[log.entity] ?? 0) + 1;
  }

  const totalActive = sessions.reduce((s, r) => s + (r.activeSeconds ?? 0), 0);
  const totalIdle = sessions.reduce((s, r) => s + (r.idleSeconds ?? 0), 0);
  const totalSessions = sessions.length;
  const efficiency = (totalActive + totalIdle) > 0
    ? Math.round((totalActive / (totalActive + totalIdle)) * 100)
    : 0;

  res.json({ user, sessions, moduleLogs, moduleBreakdown, totalActive, totalIdle, totalSessions, efficiency });
});

// ── Admin: all users summary ──────────────────────────────────────────────────

router.get("/activity/summary", requirePermissionLevel("super_admin"), async (req, res): Promise<void> => {
  const rows = await db.select({
    userId: userActivitySessionsTable.userId,
    userName: usersTable.name,
    uniqueUserId: userActivitySessionsTable.uniqueUserId,
    activeSeconds: sql<number>`SUM(${userActivitySessionsTable.activeSeconds})`,
    idleSeconds: sql<number>`SUM(${userActivitySessionsTable.idleSeconds})`,
    sessions: sql<number>`COUNT(${userActivitySessionsTable.id})`,
  })
    .from(userActivitySessionsTable)
    .leftJoin(usersTable, eq(userActivitySessionsTable.userId, usersTable.id))
    .groupBy(userActivitySessionsTable.userId, usersTable.name, userActivitySessionsTable.uniqueUserId)
    .orderBy(desc(sql`SUM(${userActivitySessionsTable.activeSeconds})`))
    .limit(50);

  res.json(rows.map(r => {
    const total = Number(r.activeSeconds) + Number(r.idleSeconds);
    return { ...r, efficiency: total > 0 ? Math.round((Number(r.activeSeconds) / total) * 100) : 0 };
  }));
});

export default router;
