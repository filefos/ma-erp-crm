import { Router } from "express";
import { db, emailSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, inScope, requirePermission } from "../middlewares/auth";
import { logger } from "../lib/logger";
import nodemailer from "nodemailer";
import * as tls from "tls";
import * as net from "net";

/**
 * Test IMAP credentials using the raw IMAP LOGIN command (like Python imaplib).
 * This avoids ImapFlow's SASL PLAIN which some Dovecot servers reject.
 */
async function testImapLogin(host: string, port: number, secure: boolean, user: string, pass: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tag = "A001";
    let buf = "";
    let loggedIn = false;

    const onData = (chunk: Buffer) => {
      buf += chunk.toString();
      const lines = buf.split("\r\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!loggedIn) {
          if (line.startsWith("* OK")) {
            // Server ready — send LOGIN
            const cmd = `${tag} LOGIN ${JSON.stringify(user)} ${JSON.stringify(pass)}\r\n`;
            sock.write(cmd);
            loggedIn = true;
          } else if (line.startsWith("* ")) {
            // Server info line, ignore
          } else {
            reject(new Error(`Unexpected greeting: ${line}`));
            sock.destroy();
          }
        } else {
          if (line.startsWith(`${tag} OK`)) {
            sock.write(`A002 LOGOUT\r\n`);
            resolve();
            sock.destroy();
          } else if (line.startsWith(`${tag} NO`) || line.startsWith(`${tag} BAD`)) {
            reject(new Error(`Authentication failed: ${line}`));
            sock.destroy();
          }
        }
      }
    };

    let sock: tls.TLSSocket | net.Socket;

    if (secure) {
      sock = tls.connect({ host, port, rejectUnauthorized: false }, () => {});
    } else {
      sock = net.connect({ host, port });
    }

    sock.on("data", onData);
    sock.on("error", (err) => reject(err));
    sock.setTimeout(10000, () => { reject(new Error("IMAP connection timed out")); sock.destroy(); });
  });
}

const router = Router();
router.use(requireAuth);

function resolveCompanyId(req: any, res: any): number | null {
  const raw = req.query.companyId ?? req.body?.companyId ?? (req.user as any)?.companyId ?? null;
  if (raw == null) {
    res.status(400).json({ error: "companyId required" });
    return null;
  }
  const id = parseInt(String(raw), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid companyId" });
    return null;
  }
  if (!inScope(req, id)) {
    res.status(403).json({ error: "Forbidden", message: "You do not have access to that company" });
    return null;
  }
  return id;
}

router.get("/email-settings", requirePermission("email_settings", "view"), async (req, res): Promise<void> => {
  const companyId = resolveCompanyId(req, res);
  if (companyId == null) return;
  const [settings] = await db.select().from(emailSettingsTable).where(eq(emailSettingsTable.companyId, companyId));
  if (!settings) { res.json(null); return; }
  const masked = { ...settings, smtpPass: settings.smtpPass ? "••••••••" : "", imapPass: settings.imapPass ? "••••••••" : "" };
  res.json(masked);
});

router.post("/email-settings", requirePermission("email_settings", "edit"), async (req, res): Promise<void> => {
  const companyId = resolveCompanyId(req, res);
  if (companyId == null) return;
  const payload = {
    companyId,
    smtpHost: req.body.smtpHost ?? null,
    smtpPort: req.body.smtpPort ? parseInt(req.body.smtpPort, 10) : 587,
    smtpUser: req.body.smtpUser ?? null,
    smtpFromName: req.body.smtpFromName ?? null,
    smtpSecure: req.body.smtpSecure ?? "starttls",
    imapHost: req.body.imapHost ?? null,
    imapPort: req.body.imapPort ? parseInt(req.body.imapPort, 10) : 993,
    imapUser: req.body.imapUser ?? null,
    imapSecure: req.body.imapSecure ?? "ssl",
    updatedAt: new Date(),
  } as any;
  if (req.body.smtpPass && req.body.smtpPass !== "••••••••") payload.smtpPass = req.body.smtpPass;
  if (req.body.imapPass && req.body.imapPass !== "••••••••") payload.imapPass = req.body.imapPass;

  const [existing] = await db.select().from(emailSettingsTable).where(eq(emailSettingsTable.companyId, companyId));
  let result;
  if (existing) {
    [result] = await db.update(emailSettingsTable).set(payload).where(eq(emailSettingsTable.companyId, companyId)).returning();
  } else {
    [result] = await db.insert(emailSettingsTable).values(payload).returning();
  }
  const masked = { ...result, smtpPass: result.smtpPass ? "••••••••" : "", imapPass: result.imapPass ? "••••••••" : "" };
  res.json(masked);
});

router.post("/email-settings/test-smtp", requirePermission("email_settings", "view"), async (req, res): Promise<void> => {
  const companyId = resolveCompanyId(req, res);
  if (companyId == null) return;
  const [settings] = await db.select().from(emailSettingsTable).where(eq(emailSettingsTable.companyId, companyId));
  if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPass) {
    res.status(400).json({ error: "SMTP settings not configured" });
    return;
  }
  try {
    const transport = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort ?? 587,
      secure: settings.smtpSecure === "ssl",
      requireTLS: settings.smtpSecure === "starttls",
      auth: { user: settings.smtpUser, pass: settings.smtpPass },
    });
    await transport.verify();
    res.json({ success: true, message: "SMTP connection successful!" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/email-settings/test-imap", requirePermission("email_settings", "view"), async (req, res): Promise<void> => {
  const companyId = resolveCompanyId(req, res);
  if (companyId == null) return;
  const [settings] = await db.select().from(emailSettingsTable).where(eq(emailSettingsTable.companyId, companyId));
  if (!settings?.imapHost || !settings?.imapUser || !settings?.imapPass) {
    res.status(400).json({ error: "IMAP settings not configured" });
    return;
  }
  try {
    await testImapLogin(
      settings.imapHost,
      settings.imapPort ?? 993,
      settings.imapSecure === "ssl",
      settings.imapUser,
      settings.imapPass,
    );
    res.json({ success: true, message: "IMAP connection successful!" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/email-settings", requirePermission("email_settings", "delete"), async (req, res): Promise<void> => {
  const companyId = resolveCompanyId(req, res);
  if (companyId == null) return;
  await db.delete(emailSettingsTable).where(eq(emailSettingsTable.companyId, companyId));
  res.json({ success: true });
});

export default router;
