import { Router, type Request } from "express";
import crypto from "crypto";
import {
  db,
  whatsappAccountsTable,
  whatsappThreadsTable,
  whatsappMessagesTable,
  leadsTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const VERIFY_TOKEN_ENV = "WHATSAPP_VERIFY_TOKEN";
const APP_SECRET_ENV = "WHATSAPP_APP_SECRET";

function timingSafeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function verifySignature(req: Request): boolean {
  const secret = process.env[APP_SECRET_ENV];
  if (!secret) {
    // If no secret is configured, refuse — never accept unsigned events.
    logger.warn(`${APP_SECRET_ENV} not set; rejecting webhook`);
    return false;
  }
  const header = req.headers["x-hub-signature-256"];
  const sig = Array.isArray(header) ? header[0] : header;
  if (!sig || !sig.startsWith("sha256=")) return false;
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!raw) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return timingSafeEq(expected, sig);
}

// GET handshake
router.get("/whatsapp/webhook", (req, res): void => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expected = process.env[VERIFY_TOKEN_ENV];
  if (mode === "subscribe" && expected && token === expected) {
    res.status(200).type("text/plain").send(String(challenge ?? ""));
    return;
  }
  res.status(403).end();
});

interface WaMessageEvent {
  from: string;
  id: string;
  timestamp?: string;
  type: string;
  text?: { body?: string };
  image?: { caption?: string; id?: string };
  document?: { caption?: string; id?: string; filename?: string };
  audio?: { id?: string };
  video?: { caption?: string; id?: string };
  sticker?: { id?: string };
  location?: { latitude?: number; longitude?: number; name?: string };
  reaction?: { message_id?: string; emoji?: string };
}

interface WaStatusEvent {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; message?: string; title?: string }>;
}

interface WaContactEvent {
  wa_id: string;
  profile?: { name?: string };
}

async function ensureLead(peerWaId: string, peerName: string | null, companyId: number | null): Promise<number | null> {
  // Find an existing lead by phone/whatsapp, scoped to this account's company
  // so that inbound messages on tenant A never accidentally bind to a lead
  // owned by tenant B (numbers can overlap across tenants).
  const all = companyId == null
    ? await db.select().from(leadsTable).where(sql`${leadsTable.companyId} IS NULL`)
    : await db.select().from(leadsTable).where(eq(leadsTable.companyId, companyId));
  const match = all.find(l => {
    const a = String(l.whatsapp ?? "").replace(/[^0-9]/g, "");
    const b = String(l.phone ?? "").replace(/[^0-9]/g, "");
    return a === peerWaId || b === peerWaId;
  });
  if (match) return match.id;

  // Auto-create a Lead from inbound WA so the team has a place to reply from.
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(leadsTable);
  const num = (count[0]?.count ?? 0) + 1;
  const year = new Date().getFullYear();
  const leadNumber = `LEAD-${year}-${String(num).padStart(4, "0")}`;
  const [lead] = await db.insert(leadsTable).values({
    leadNumber,
    leadName: peerName ?? `WhatsApp +${peerWaId}`,
    contactPerson: peerName,
    phone: `+${peerWaId}`,
    whatsapp: `+${peerWaId}`,
    source: "whatsapp",
    status: "new",
    leadScore: "warm",
    companyId,
    notes: "Auto-created from inbound WhatsApp message",
  }).returning();
  return lead.id;
}

async function getOrCreateThread(accountId: number, peerWaId: string, peerName: string | null, companyId: number | null) {
  const [existing] = await db.select().from(whatsappThreadsTable)
    .where(and(eq(whatsappThreadsTable.accountId, accountId), eq(whatsappThreadsTable.peerWaId, peerWaId)));
  if (existing) {
    if (peerName && !existing.peerName) {
      await db.update(whatsappThreadsTable).set({ peerName, updatedAt: new Date() }).where(eq(whatsappThreadsTable.id, existing.id));
    }
    return existing;
  }
  const leadId = await ensureLead(peerWaId, peerName, companyId);
  const [t] = await db.insert(whatsappThreadsTable).values({
    accountId,
    peerWaId,
    peerName,
    leadId,
    companyId,
    unreadCount: 0,
  }).returning();
  return t;
}

function bodyForMessage(m: WaMessageEvent): { body: string | null; mediaCaption: string | null } {
  switch (m.type) {
    case "text": return { body: m.text?.body ?? null, mediaCaption: null };
    case "image": return { body: m.image?.caption ?? "[image]", mediaCaption: m.image?.caption ?? null };
    case "document": return { body: m.document?.caption ?? `[document: ${m.document?.filename ?? "file"}]`, mediaCaption: m.document?.caption ?? null };
    case "audio": return { body: "[audio]", mediaCaption: null };
    case "video": return { body: m.video?.caption ?? "[video]", mediaCaption: m.video?.caption ?? null };
    case "sticker": return { body: "[sticker]", mediaCaption: null };
    case "location": return { body: `[location: ${m.location?.latitude},${m.location?.longitude}${m.location?.name ? " — " + m.location.name : ""}]`, mediaCaption: null };
    case "reaction": return { body: `[reaction ${m.reaction?.emoji ?? ""}]`, mediaCaption: null };
    default: return { body: `[${m.type}]`, mediaCaption: null };
  }
}

router.post("/whatsapp/webhook", async (req, res): Promise<void> => {
  if (!verifySignature(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  // Always 200 quickly to avoid Meta retries; process best-effort.
  res.status(200).json({ received: true });

  try {
    const body = req.body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            metadata?: { phone_number_id?: string };
            contacts?: WaContactEvent[];
            messages?: WaMessageEvent[];
            statuses?: WaStatusEvent[];
          };
        }>;
      }>;
    };

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;
        const [account] = await db.select().from(whatsappAccountsTable).where(eq(whatsappAccountsTable.phoneNumberId, phoneNumberId));
        if (!account) {
          logger.warn({ phoneNumberId }, "Webhook for unknown WhatsApp account");
          continue;
        }
        const contacts = value.contacts ?? [];
        const messages = value.messages ?? [];
        const statuses = value.statuses ?? [];

        for (const m of messages) {
          const peerWaId = m.from;
          const peerName = contacts.find(c => c.wa_id === peerWaId)?.profile?.name ?? null;
          const thread = await getOrCreateThread(account.id, peerWaId, peerName, account.companyId ?? null);
          // De-dupe by waMessageId
          const dup = await db.select({ id: whatsappMessagesTable.id }).from(whatsappMessagesTable)
            .where(eq(whatsappMessagesTable.waMessageId, m.id));
          if (dup.length > 0) continue;
          const { body: msgBody, mediaCaption } = bodyForMessage(m);
          const ts = m.timestamp ? new Date(parseInt(m.timestamp, 10) * 1000) : new Date();
          await db.insert(whatsappMessagesTable).values({
            threadId: thread.id,
            accountId: account.id,
            direction: "in",
            waMessageId: m.id,
            fromWa: peerWaId,
            toWa: account.displayPhone ?? null,
            messageType: m.type,
            body: msgBody,
            mediaCaption,
            status: "received",
            receivedAt: ts,
          });
          await db.update(whatsappThreadsTable).set({
            lastMessageAt: ts,
            lastMessagePreview: (msgBody ?? "").slice(0, 200),
            lastDirection: "in",
            unreadCount: sql`${whatsappThreadsTable.unreadCount} + 1`,
            updatedAt: new Date(),
          }).where(eq(whatsappThreadsTable.id, thread.id));
        }

        for (const s of statuses) {
          const ts = s.timestamp ? new Date(parseInt(s.timestamp, 10) * 1000) : new Date();
          const update: Record<string, unknown> = { status: s.status };
          if (s.status === "sent") update.sentAt = ts;
          else if (s.status === "delivered") update.deliveredAt = ts;
          else if (s.status === "read") update.readAt = ts;
          else if (s.status === "failed") {
            update.errorCode = s.errors?.[0]?.code ?? null;
            update.errorText = s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? "failed";
          }
          await db.update(whatsappMessagesTable).set(update).where(eq(whatsappMessagesTable.waMessageId, s.id));
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "WhatsApp webhook processing failed");
  }
});

export default router;
