import { Router } from "express";
import { spawn } from "child_process";
import { logger } from "../lib/logger";

const router = Router();

/**
 * POST /api/deploy
 * Called by GitHub Actions on every push to main.
 * Verifies the DEPLOY_SECRET token then spawns a detached
 * git pull + build + pm2 restart as a background process.
 */
router.post("/deploy", (req, res) => {
  const secret = process.env.DEPLOY_SECRET ?? "";
  const auth = req.headers["x-deploy-token"] ?? "";

  if (!secret || auth !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const APP_DIR = process.env.APP_DIR ?? "/home/deploy/apps/ma-erp";
  const PM2_NAME = process.env.PM2_NAME ?? "ma-erp-api";
  const deployId = Date.now().toString(36);
  logger.info({ deployId }, "Deploy triggered via webhook");

  res.json({ status: "deploying", deployId });

  const WEB_ROOT = process.env.WEB_ROOT ?? "/var/www/ma-erp";
  const script = [
    `cd ${APP_DIR}`,
    `git pull origin main 2>&1`,
    `pnpm install --frozen-lockfile 2>&1`,
    `pnpm --filter @workspace/erp-crm run build 2>&1`,
    `pnpm --filter @workspace/api-server run build 2>&1`,
    // Copy fresh frontend dist to nginx-served directory
    `mkdir -p ${WEB_ROOT}`,
    `cp -r ${APP_DIR}/artifacts/erp-crm/dist/. ${WEB_ROOT}/`,
    `chown -R www-data:www-data ${WEB_ROOT} 2>/dev/null || true`,
    `pm2 startOrRestart ${APP_DIR}/ecosystem.config.cjs --update-env 2>&1`,
    `echo "Deploy ${deployId} complete"`,
  ].join(" && ");

  const child = spawn("bash", ["-c", script], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      PATH: `/root/.local/share/pnpm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${process.env.PATH ?? ""}`,
    },
  });
  child.unref();

  logger.info({ deployId, pid: child.pid }, "Deploy process spawned");
});

export default router;
