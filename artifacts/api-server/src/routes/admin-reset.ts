import { Router } from "express";
import { spawn } from "node:child_process";
import path from "node:path";
import { db, auditLogsTable } from "@workspace/db";
import { requireAuth, requirePermissionLevel } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

const CONFIRM_PHRASE = "FACTORY RESET";

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
        details: `Super admin ${req.user!.email} initiated FACTORY RESET — all data will be wiped and demo seed restored`,
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

export default router;
