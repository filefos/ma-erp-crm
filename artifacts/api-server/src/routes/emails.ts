import { Router } from "express";
import { db, emailsTable, emailSettingsTable } from "@workspace/db";
import { eq, sql, and, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
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

  if (folder) rows = rows.filter(r => r.folder === folder);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
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

router.post("/emails", requireAuth, async (req, res): Promise<void> => {
  const data = req.body;
  const userId = req.user?.id;
  const isSend = data.action === "send";

  const fromAddress = data.fromAddress ?? process.env.SMTP_USER ?? process.env.SMTP_FROM ?? "noreply@primemaxprefab.com";
  const fromName = data.fromName ?? (req.user as any)?.name ?? "Prime Max ERP";

  if (isSend) {
    const transporter = getTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"${fromName}" <${fromAddress}>`,
          to: data.toAddress,
          cc: data.ccAddress || undefined,
          bcc: data.bccAddress || undefined,
          subject: data.subject,
          html: data.body.replace(/\n/g, "<br>"),
          text: data.body,
        });
        logger.info("Email sent via SMTP to " + data.toAddress);
      } catch (err: any) {
        logger.warn({ err }, "SMTP send failed, saving to sent folder anyway");
      }
    }

    const [email] = await db.insert(emailsTable).values({
      companyId: data.companyId ?? null,
      folder: "sent",
      fromAddress,
      fromName,
      toAddress: data.toAddress,
      toName: data.toName ?? null,
      ccAddress: data.ccAddress ?? null,
      bccAddress: data.bccAddress ?? null,
      subject: data.subject,
      body: data.body,
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

router.get("/emails/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [email] = await db.select().from(emailsTable).where(eq(emailsTable.id, id));
  if (!email) { res.status(404).json({ error: "Not found" }); return; }
  res.json(email);
});

router.patch("/emails/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(emailsTable).where(eq(emailsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
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
  if (existing.folder === "trash") {
    await db.delete(emailsTable).where(eq(emailsTable.id, id));
  } else {
    await db.update(emailsTable).set({ folder: "trash", updatedAt: new Date() }).where(eq(emailsTable.id, id));
  }
  res.json({ success: true });
});

router.post("/emails/sync", requireAuth, async (req, res): Promise<void> => {
  const companyId = req.body.companyId ?? (req.user as any)?.companyId ?? 1;
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
