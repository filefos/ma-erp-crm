import { Router } from "express";
import { db, emailSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import nodemailer from "nodemailer";

const router = Router();
router.use(requireAuth);

router.get("/email-settings", async (req, res): Promise<void> => {
  const companyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : (req.user as any)?.companyId ?? 1;
  const [settings] = await db.select().from(emailSettingsTable).where(eq(emailSettingsTable.companyId, companyId));
  if (!settings) { res.json(null); return; }
  const masked = { ...settings, smtpPass: settings.smtpPass ? "••••••••" : "", imapPass: settings.imapPass ? "••••••••" : "" };
  res.json(masked);
});

router.post("/email-settings", async (req, res): Promise<void> => {
  const companyId = req.body.companyId ?? (req.user as any)?.companyId ?? 1;
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

router.post("/email-settings/test-smtp", async (req, res): Promise<void> => {
  const companyId = req.body.companyId ?? (req.user as any)?.companyId ?? 1;
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
      tls: { rejectUnauthorized: false },
    });
    await transport.verify();
    res.json({ success: true, message: "SMTP connection successful!" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/email-settings/test-imap", async (req, res): Promise<void> => {
  const companyId = req.body.companyId ?? (req.user as any)?.companyId ?? 1;
  const [settings] = await db.select().from(emailSettingsTable).where(eq(emailSettingsTable.companyId, companyId));
  if (!settings?.imapHost || !settings?.imapUser || !settings?.imapPass) {
    res.status(400).json({ error: "IMAP settings not configured" });
    return;
  }
  try {
    const { ImapFlow } = await import("imapflow");
    const client = new ImapFlow({
      host: settings.imapHost,
      port: settings.imapPort ?? 993,
      secure: settings.imapSecure === "ssl",
      auth: { user: settings.imapUser, pass: settings.imapPass },
      logger: false,
      tls: { rejectUnauthorized: false },
    });
    await client.connect();
    await client.logout();
    res.json({ success: true, message: "IMAP connection successful!" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
