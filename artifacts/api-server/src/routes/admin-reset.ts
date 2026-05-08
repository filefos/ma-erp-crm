import { Router } from "express";
import { spawn } from "node:child_process";
import path from "node:path";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, auditLogsTable, usersTable, notificationsTable } from "@workspace/db";
import { requireAuth, requirePermissionLevel } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

const CONFIRM_PHRASE = "FACTORY RESET";
const DEFAULT_TEMP_PASSWORD = "Reset@2026";

router.post(
  "/admin/factory-reset",
  requirePermissionLevel("super_admin"),
  async (req, res): Promise<void> => {
    const confirm = (req.body?.confirm ?? "").toString().trim();
    if (confirm !== CONFIRM_PHRASE) {
      res.status(400).json({ error: `Confirmation required. Type "${CONFIRM_PHRASE}" to proceed.` });
      return;
    }

    const monorepoRoot = path.resolve(process.cwd(), "..", "..");
    req.log.warn({ user: req.user?.email, root: monorepoRoot }, "FACTORY RESET initiated");

    try {
      await db.insert(auditLogsTable).values({
        userId: req.user!.id,
        userName: req.user!.name,
        action: "factory_reset",
        entity: "system",
        details: `Main admin ${req.user!.email} initiated FACTORY RESET — all data will be wiped and demo seed restored`,
        ipAddress: req.ip ?? null,
      });
    } catch (e) {
      req.log.error({ err: e }, "Failed to write factory_reset audit log (non-fatal)");
    }

    const child = spawn("pnpm", ["--filter", "@workspace/scripts", "run", "seed"], {
      cwd: monorepoRoot,
      env: { ...process.env },
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
    }, 120_000);

    child.on("error", (err) => {
      clearTimeout(timeout);
      req.log.error({ err }, "Factory reset spawn error");
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to launch seed process", detail: err.message });
      }
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        req.log.warn("Factory reset completed successfully");
        res.json({
          ok: true,
          message: "Factory reset complete. All data has been wiped and the demo dataset restored. You will be logged out — sign in again with admin@erp.com / Admin@2026.",
        });
      } else {
        req.log.error({ code, stderr, stdout }, "Factory reset failed");
        res.status(500).json({
          error: "Factory reset failed",
          exitCode: code,
          stderr: stderr.slice(-2000),
          stdout: stdout.slice(-2000),
        });
      }
    });
  },
);

router.post(
  "/admin/users/:id/freeze",
  requirePermissionLevel("super_admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    if (id === req.user!.id) {
      res.status(400).json({ error: "You cannot freeze your own account" });
      return;
    }
    const frozen = req.body?.frozen !== false;
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    await db
      .update(usersTable)
      .set({
        isActive: !frozen,
        status: frozen ? "inactive" : "active",
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, id));

    await db.insert(auditLogsTable).values({
      userId: req.user!.id,
      userName: req.user!.name,
      action: frozen ? "freeze_user" : "unfreeze_user",
      entity: "user",
      entityId: id,
      details: `${frozen ? "Froze" : "Unfroze"} user ${target.email} by ${req.user!.email}`,
      ipAddress: req.ip ?? null,
    });

    res.json({
      ok: true,
      frozen,
      message: `${target.email} has been ${frozen ? "frozen" : "unfrozen"}.`,
    });
  },
);

router.post(
  "/admin/users/:id/purge",
  requirePermissionLevel("super_admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    if (id === req.user!.id) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }

    const confirm = (req.body?.confirm ?? "").toString().trim();
    const expected = "DELETE";
    if (confirm !== expected) {
      res.status(400).json({ error: `Confirmation required. Type "${expected}" to proceed.` });
      return;
    }

    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (target.permissionLevel === "super_admin") {
      const otherAdmins = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.permissionLevel, "super_admin"));
      const remaining = otherAdmins.filter((u) => u.id !== id);
      if (remaining.length === 0) {
        res.status(400).json({ error: "Cannot delete the last main admin." });
        return;
      }
    }

    const stamp = Date.now();
    const scrambledEmail = `deleted-${id}-${stamp}@deleted.local`;
    const randomHash = await bcrypt.hash(`purged-${id}-${stamp}-${Math.random()}`, 10);

    await db
      .update(usersTable)
      .set({
        email: scrambledEmail,
        name: "(deleted user)",
        phone: null,
        passwordHash: randomHash,
        isActive: false,
        status: "deleted",
        permissionLevel: "user",
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, id));

    const cleared = await db
      .delete(notificationsTable)
      .where(eq(notificationsTable.userId, id))
      .returning({ id: notificationsTable.id });

    await db.insert(auditLogsTable).values({
      userId: req.user!.id,
      userName: req.user!.name,
      action: "delete_user",
      entity: "user",
      entityId: id,
      details: `Main admin ${req.user!.email} permanently deleted user ${target.email} (was ${target.name}). ${cleared.length} notifications cleared. Original email released for re-use.`,
      ipAddress: req.ip ?? null,
    });

    res.json({
      ok: true,
      releasedEmail: target.email,
      notificationsCleared: cleared.length,
      message: `User ${target.email} has been deleted. The email address is now free to be re-used.`,
    });
  },
);

router.post(
  "/admin/users/:id/reset-account",
  requirePermissionLevel("super_admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }

    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const tempPassword = (req.body?.tempPassword ?? DEFAULT_TEMP_PASSWORD).toString();
    if (tempPassword.length < 8) {
      res.status(400).json({ error: "Temp password must be at least 8 characters" });
      return;
    }

    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await db
      .update(usersTable)
      .set({ passwordHash, isActive: true, status: "active", updatedAt: new Date() })
      .where(eq(usersTable.id, id));

    const cleared = await db
      .delete(notificationsTable)
      .where(eq(notificationsTable.userId, id))
      .returning({ id: notificationsTable.id });

    await db.insert(auditLogsTable).values({
      userId: req.user!.id,
      userName: req.user!.name,
      action: "reset_account",
      entity: "user",
      entityId: id,
      details: `Account reset by ${req.user!.email} for user ${target.email} — password reset, account reactivated, ${cleared.length} notifications cleared`,
      ipAddress: req.ip ?? null,
    });

    res.json({
      ok: true,
      tempPassword,
      notificationsCleared: cleared.length,
      message: `Account for ${target.email} has been reset.`,
    });
  },
);

export default router;
