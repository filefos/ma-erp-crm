import { Router } from "express";
import { db, emailsTable, emailSettingsTable } from "@workspace/db";
import { eq, sql, and, or } from "drizzle-orm";
import { requireAuth, scopeFilter, inScope, requireBodyCompanyAccess } from "../middlewares/auth";
import nodemailer from "nodemailer";
import { logger } from "../lib/logger";

const router = Router();
router.use(requireAuth);

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

router.get("/emails", requireAuth, async (req, res): Promise<void> => {
  const { folder, companyId, search } = req.query;
  let rows = await db.select().from(emailsTable).orderBy(sql`${emailsTable.createdAt} desc`);

  rows = scopeFilter(req, rows);
  if (folder) rows = rows.filter(r => r.folder === folder);
  if (companyId) {
    const cid = parseInt(companyId as string, 10);
    if (!inScope(req, cid)) { res.status(403).json({ error: "Forbidden" }); return; }
    rows = rows.filter(r => r.companyId === cid);
  }
  if (search) {
    const s = (search as string).toLowerCase();
    rows = rows.filter(r =>
      r.subject.toLowerCase().includes(s) ||
      r.fromAddress.toLowerCase().includes(s) ||
      r.toAddress.toLowerCase().includes(s) ||
      r.body.toLowerCase().includes(s)
    );
  }
  res.json(rows);
});

router.post("/emails", requireAuth, requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const userId = req.user?.id;
  const isSend = data.action === "send";

  const fromAddress = data.fromAddress ?? process.env.SMTP_USER ?? process.env.SMTP_FROM ?? "noreply@primemaxprefab.com";
  const fromName = data.fromName ?? (req.user as any)?.name ?? "Prime Max ERP";

  if (isSend) {
    const companyId = data.companyId ?? (req.user as any)?.companyId ?? null;
    const attachments: Array<{ filename: string; content: string; contentType: string }> = data.attachments ?? [];

    // Try to use company SMTP settings, fall back to env-var transporter
    let transporter = null;
    if (companyId) {
      const [settings] = await db.select().from(emailSettingsTable).where(eq(emailSettingsTable.companyId, companyId));
      if (settings?.smtpHost && settings?.smtpUser && settings?.smtpPass) {
        const fromSetting = settings.smtpFromName ? `"${settings.smtpFromName}" <${settings.smtpUser}>` : settings.smtpUser;
        transporter = nodemailer.createTransport({
          host: settings.smtpHost,
          port: settings.smtpPort ?? 587,
          secure: settings.smtpSecure === "ssl",
          requireTLS: settings.smtpSecure === "starttls",
          auth: { user: settings.smtpUser, pass: settings.smtpPass },
          tls: { rejectUnauthorized: false },
        });
        // override fromAddress/fromName from saved settings
        Object.assign(data, {
          _smtpFrom: fromSetting,
          _smtpFromAddr: settings.smtpUser,
          _smtpFromName: settings.smtpFromName ?? fromName,
        });
      }
    }
    if (!transporter) transporter = getTransporter();

    if (transporter) {
      try {
        const mailAttachments = attachments.map(a => ({
          filename: a.filename,
          content: Buffer.from(a.content, "base64"),
          contentType: a.contentType,
        }));
        await transporter.sendMail({
          from: data._smtpFrom ?? `"${fromName}" <${fromAddress}>`,
          to: data.toAddress,
          cc: data.ccAddress || undefined,
          bcc: data.bccAddress || undefined,
          subject: data.subject,
          html: data.body.replace(/\n/g, "<br>"),
          text: data.body,
          attachments: mailAttachments,
        });
        logger.info("Email sent via SMTP to " + data.toAddress);
      } catch (err: any) {
        logger.warn({ err }, "SMTP send failed, saving to sent folder anyway");
      }
    }

    const [email] = await db.insert(emailsTable).values({
      companyId: data.companyId ?? null,
      folder: "sent",
      fromAddress: data._smtpFromAddr ?? fromAddress,
      fromName: data._smtpFromName ?? fromName,
      toAddress: data.toAddress,
      toName: data.toName ?? null,
      ccAddress: data.ccAddress ?? null,
      bccAddress: data.bccAddress ?? null,
      subject: data.subject,
      body: data.body,
      attachments: attachments.map(a => ({
        filename: a.filename,
        contentType: a.contentType,
        size: a.content.length,
        content: a.content,
      })),
      isRead: true,
      replyToId: data.replyToId ?? null,
      sentAt: new Date(),
      createdById: userId ?? null,
    }).returning();
    res.status(201).json(email);
    return;
  }

  const [email] = await db.insert(emailsTable).values({
    companyId: data.companyId ?? null,
    folder: data.folder ?? "draft",
    fromAddress: data.fromAddress ?? fromAddress,
    fromName: data.fromName ?? fromName,
    toAddress: data.toAddress ?? "",
    toName: data.toName ?? null,
    ccAddress: data.ccAddress ?? null,
    bccAddress: data.bccAddress ?? null,
    subject: data.subject ?? "(No Subject)",
    body: data.body ?? "",
    isRead: data.folder === "inbox" ? false : true,
    replyToId: data.replyToId ?? null,
    sentAt: data.folder === "inbox" ? (data.sentAt ? new Date(data.sentAt) : new Date()) : null,
    createdById: userId ?? null,
  }).returning();
  res.status(201).json(email);
});

router.get("/emails/:id/attachments/:idx", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const idx = parseInt(req.params.idx, 10);
  const [email] = await db.select().from(emailsTable).where(eq(emailsTable.id, id));
  if (!email) { res.status(404).json({ error: "Not found" }); return; }
  if (!inScope(req, email.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const atts = (email.attachments ?? []) as Array<{ filename: string; contentType: string; size: number; content?: string }>;
  const att = atts[idx];
  if (!att) { res.status(404).json({ error: "Attachment not found" }); return; }
  if (!att.content) { res.status(404).json({ error: "Attachment content not stored" }); return; }
  const buf = Buffer.from(att.content, "base64");
  res.setHeader("Content-Type", att.contentType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${att.filename}"`);
  res.setHeader("Content-Length", buf.length);
  res.send(buf);
});

router.get("/emails/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [email] = await db.select().from(emailsTable).where(eq(emailsTable.id, id));
  if (!email) { res.status(404).json({ error: "Not found" }); return; }
  if (!inScope(req, email.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(email);
});

router.patch("/emails/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(emailsTable).where(eq(emailsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!inScope(req, existing.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { isRead, isStarred, folder } = req.body;
  const updates: Partial<typeof emailsTable.$inferInsert> = { updatedAt: new Date() };
  if (isRead !== undefined) updates.isRead = isRead;
  if (isStarred !== undefined) updates.isStarred = isStarred;
  if (folder !== undefined) updates.folder = folder;
  const [email] = await db.update(emailsTable).set(updates).where(eq(emailsTable.id, id)).returning();
  res.json(email);
});

router.delete("/emails/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(emailsTable).where(eq(emailsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!inScope(req, existing.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }
  if (existing.folder === "trash") {
    await db.delete(emailsTable).where(eq(emailsTable.id, id));
  } else {
    await db.update(emailsTable).set({ folder: "trash", updatedAt: new Date() }).where(eq(emailsTable.id, id));
  }
  res.json({ success: true });
});

router.post("/emails/sync", requireAuth, requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const companyId = req.body.companyId ?? (req.user as any)?.companyId ?? 1;
  if (!inScope(req, companyId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const [settings] = await db.select().from(emailSettingsTable).where(eq(emailSettingsTable.companyId, companyId));
  if (!settings?.imapHost || !settings?.imapUser || !settings?.imapPass) {
    res.status(400).json({ error: "IMAP not configured. Go to Email Settings first." });
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
    const lock = await client.getMailboxLock("INBOX");
    let fetched = 0;
    let skipped = 0;

    try {
      const status = await client.status("INBOX", { messages: true, unseen: true });
      const total = status.messages ?? 0;
      const fetchFrom = Math.max(1, total - 49);

      for await (const msg of client.fetch(`${fetchFrom}:*`, { envelope: true, source: true, flags: true })) {
        const env = msg.envelope;
        const fromAddr = env.from?.[0]?.address ?? "";
        const fromName = env.from?.[0]?.name ?? "";
        const toAddr = env.to?.[0]?.address ?? settings.imapUser;
        const subject = env.subject ?? "(No Subject)";
        const msgDate = env.date ?? new Date();

        const existing = await db.select({ id: emailsTable.id })
          .from(emailsTable)
          .where(sql`${emailsTable.fromAddress} = ${fromAddr} AND ${emailsTable.subject} = ${subject} AND ${emailsTable.folder} = 'inbox' AND ABS(EXTRACT(EPOCH FROM (${emailsTable.createdAt} - ${msgDate.toISOString()}::timestamp))) < 60`)
          .limit(1);

        if (existing.length > 0) { skipped++; continue; }

        let bodyText = "";
        try {
          const raw = msg.source?.toString() ?? "";
          const parts = raw.split(/\r?\n\r?\n/);
          bodyText = parts.slice(1).join("\n\n").replace(/<[^>]+>/g, "").replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).substring(0, 8000).trim();
          if (!bodyText) bodyText = raw.substring(0, 2000);
        } catch { bodyText = "(Unable to decode body)"; }

        const isSeen = msg.flags?.has("\\Seen") ?? false;

        await db.insert(emailsTable).values({
          companyId,
          folder: "inbox",
          fromAddress: fromAddr,
          fromName: fromName || fromAddr,
          toAddress: toAddr,
          subject,
          body: bodyText,
          isRead: isSeen,
          isStarred: false,
          sentAt: msgDate,
          createdAt: msgDate,
        });
        fetched++;
      }
    } finally {
      lock.release();
    }

    await client.logout();

    await db.update(emailSettingsTable)
      .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(emailSettingsTable.companyId, companyId));

    res.json({ success: true, fetched, skipped, message: `Synced ${fetched} new email(s).` });
  } catch (err: any) {
    logger.error({ err }, "IMAP sync failed");
    res.status(500).json({ error: err.message });
  }
});

export default router;
