// Background worker — scans for overdue lead follow-ups and overdue tax
// invoices on a recurring interval. For each match we either:
//   - create a notification for the assignee (default), or
//   - if the assignee's automation_level is fully_automatic AND a default
//     WhatsApp account is configured AND the contact has a WhatsApp number,
//     auto-send the relevant template via the Cloud API.
//
// Runs in-process from the API server. Idempotent through a small notice
// dedupe key (entity + day) so re-runs in the same day don't spam.

import {
  db,
  leadsTable,
  taxInvoicesTable,
  usersTable,
  whatsappAccountsTable,
  whatsappThreadsTable,
  whatsappMessagesTable,
  notificationsTable,
  auditLogsTable,
  activitiesTable,
  quotationsTable,
} from "@workspace/db";
import { and, eq, sql, desc, gte } from "drizzle-orm";
import { logger } from "../lib/logger";
import { aiAvailable, chat, aiModelName } from "../lib/ai";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? "v20.0";
const SCAN_INTERVAL_MS = Number(process.env.FOLLOWUP_SCAN_INTERVAL_MS ?? 60 * 60 * 1000); // hourly default
const STARTUP_DELAY_MS = Number(process.env.FOLLOWUP_STARTUP_DELAY_MS ?? 30_000);
// Auto-send must use an approved Cloud API template. Operators register the
// template name + language with Meta; we reference it by name here.
const FOLLOWUP_TEMPLATE_NAME = process.env.WHATSAPP_FOLLOWUP_TEMPLATE ?? "lead_followup";
const FOLLOWUP_TEMPLATE_LANG = process.env.WHATSAPP_FOLLOWUP_TEMPLATE_LANG ?? "en_US";
// Skip a lead reminder if any activity has been logged against it in the last
// N days — prevents spamming reps who have already touched the lead recently.
const MIN_DAYS_SINCE_ACTIVITY = Math.max(0, Number(process.env.FOLLOWUP_MIN_DAYS_SINCE_ACTIVITY ?? 2));

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeWa(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/[^0-9]/g, "");
}

interface AutoUserShape { id: number; name: string; automationLevel?: string | null }

async function getAutomationLevel(userId: number | null | undefined): Promise<string> {
  if (!userId) return "suggest";
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return (u as unknown as AutoUserShape | undefined)?.automationLevel ?? "suggest";
}

async function defaultAccountForCompany(companyId: number | null | undefined) {
  const all = await db.select().from(whatsappAccountsTable).where(eq(whatsappAccountsTable.isActive, true));
  if (companyId != null) {
    const m = all.find(a => a.companyId === companyId && a.isDefault) ?? all.find(a => a.companyId === companyId);
    if (m) return m;
  }
  return all.find(a => a.isDefault) ?? all[0];
}

async function alreadyNotifiedToday(userId: number, entityType: string, entityId: number): Promise<boolean> {
  const day = todayKey();
  const rows = await db.select({ id: notificationsTable.id }).from(notificationsTable)
    .where(and(
      eq(notificationsTable.userId, userId),
      eq(notificationsTable.entityType, entityType),
      eq(notificationsTable.entityId, entityId),
      sql`to_char(${notificationsTable.createdAt}, 'YYYY-MM-DD') = ${day}`,
    ))
    .limit(1);
  return rows.length > 0;
}

async function notify(userId: number, title: string, message: string, entityType: string, entityId: number, type = "info"): Promise<void> {
  if (await alreadyNotifiedToday(userId, entityType, entityId)) return;
  await db.insert(notificationsTable).values({ userId, title, message, type, entityType, entityId });
}

async function autoLog(action: string, entity: string, entityId: number | null, details: string): Promise<void> {
  await db.insert(auditLogsTable).values({
    userId: null,
    userName: "system:follow-up-worker",
    action,
    entity,
    entityId,
    details,
  });
}

interface SendResult { ok: boolean; waMessageId: string | null; error?: string }

// Send an approved Cloud API template. We use templates here (rather than
// freeform text) so the message complies with Meta's rules for outbound,
// business-initiated WhatsApp outside the 24-hour customer-care window.
async function sendWhatsAppTemplate(opts: {
  account: typeof whatsappAccountsTable.$inferSelect;
  toWa: string;
  templateName: string;
  templateLanguage: string;
  bodyParams: string[];
  previewBody: string;
  leadId?: number | null;
  dealId?: number | null;
  contactId?: number | null;
  projectId?: number | null;
  sentByUserId: number | null;
}): Promise<SendResult> {
  const { account, toWa, templateName, templateLanguage, bodyParams, previewBody } = opts;
  const tokenName = account.accessTokenEnv || "WHATSAPP_ACCESS_TOKEN";
  const token = process.env[tokenName];
  if (!token) return { ok: false, waMessageId: null, error: `env ${tokenName} not set` };

  let [thread] = await db.select().from(whatsappThreadsTable)
    .where(and(eq(whatsappThreadsTable.accountId, account.id), eq(whatsappThreadsTable.peerWaId, toWa)));
  if (!thread) {
    [thread] = await db.insert(whatsappThreadsTable).values({
      accountId: account.id,
      peerWaId: toWa,
      peerName: null,
      leadId: opts.leadId ?? null,
      dealId: opts.dealId ?? null,
      contactId: opts.contactId ?? null,
      projectId: opts.projectId ?? null,
      companyId: account.companyId ?? null,
      unreadCount: 0,
    }).returning();
  }

  const components = bodyParams.length
    ? [{ type: "body", parameters: bodyParams.map(text => ({ type: "text", text })) }]
    : undefined;

  const [queued] = await db.insert(whatsappMessagesTable).values({
    threadId: thread.id,
    accountId: account.id,
    direction: "out",
    fromWa: account.displayPhone ?? null,
    toWa,
    messageType: "template",
    body: previewBody,
    templateName,
    templateLanguage,
    templateVars: components ? JSON.stringify(components) : null,
    status: "queued",
    sentById: opts.sentByUserId,
  }).returning();

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${account.phoneNumberId}/messages`;
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: toWa,
    recipient_type: "individual",
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLanguage },
      ...(components ? { components } : {}),
    },
  };
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network error";
    await db.update(whatsappMessagesTable).set({ status: "failed", errorText: msg }).where(eq(whatsappMessagesTable.id, queued.id));
    return { ok: false, waMessageId: null, error: msg };
  }
  const json = (await response.json().catch(() => ({}))) as { messages?: Array<{ id: string }>; error?: { message?: string; code?: number } };
  if (!response.ok) {
    await db.update(whatsappMessagesTable).set({
      status: "failed",
      errorCode: json.error?.code ?? response.status,
      errorText: json.error?.message ?? `HTTP ${response.status}`,
    }).where(eq(whatsappMessagesTable.id, queued.id));
    return { ok: false, waMessageId: null, error: json.error?.message ?? `HTTP ${response.status}` };
  }
  const waMessageId = json.messages?.[0]?.id ?? null;
  const now = new Date();
  await db.update(whatsappMessagesTable).set({ waMessageId, status: "sent", sentAt: now })
    .where(eq(whatsappMessagesTable.id, queued.id));
  await db.update(whatsappThreadsTable).set({
    lastMessageAt: now,
    lastMessagePreview: previewBody.slice(0, 200),
    lastDirection: "out",
    updatedAt: now,
  }).where(eq(whatsappThreadsTable.id, thread.id));
  return { ok: true, waMessageId };
}

function leadFollowupBody(lead: typeof leadsTable.$inferSelect): string {
  const name = lead.contactPerson || lead.leadName || "there";
  const req = lead.requirementType ? ` for your ${lead.requirementType.toLowerCase()}` : "";
  return `Hi ${name}, this is the sales team at Prime Max & Elite Prefab. Just following up${req} — happy to share an updated quote or schedule a quick site visit at your convenience. When works best for you?`;
}

async function aiDraftLeadFollowup(lead: typeof leadsTable.$inferSelect): Promise<{ text: string; prompt: string } | null> {
  if (!aiAvailable()) return null;
  const system = "You are a sales assistant at Prime Max & Elite Prefab (UAE prefab construction). Draft a short (<70 words), warm WhatsApp follow-up to a customer whose follow-up date has passed. Output only the message body.";
  const ctx = [
    `Customer: ${lead.contactPerson || lead.leadName}${lead.companyName ? ` (${lead.companyName})` : ""}`,
    `Requirement: ${lead.requirementType ?? "?"} · Budget: ${lead.budget ?? "?"} · Status: ${lead.status} · Last follow-up was scheduled for ${lead.nextFollowUp ?? "?"}`,
    lead.notes ? `Notes: ${lead.notes}` : "",
  ].filter(Boolean).join("\n");
  try {
    const text = await chat([
      { role: "system", content: system },
      { role: "user", content: ctx },
    ], { maxCompletionTokens: 300 });
    return { text, prompt: ctx };
  } catch (err) {
    logger.warn({ err, leadId: lead.id }, "AI draft failed for overdue lead");
    return null;
  }
}

async function scanLeads(): Promise<void> {
  const today = todayKey();
  const leads = await db.select().from(leadsTable);
  for (const l of leads) {
    if (!l.isActive) continue;
    if (l.status === "won" || l.status === "lost") continue;
    if (!l.nextFollowUp) continue;
    if (l.nextFollowUp >= today) continue; // not yet overdue
    if (!l.assignedToId) continue;

    const level = await getAutomationLevel(l.assignedToId);
    // "off" disables AI features entirely; "suggest" means on-demand only
    // (AI is offered in the UI but the cron does NOT push reminders or
    // drafts). Cron-driven reminders run only for auto_with_approval and
    // fully_automatic.
    if (level !== "auto_with_approval" && level !== "fully_automatic") continue;

    // Activity-based gating: if the assignee (or anyone) has logged activity
    // against this lead within the last MIN_DAYS_SINCE_ACTIVITY days, the
    // lead is being actively worked — skip the reminder/auto-send.
    if (MIN_DAYS_SINCE_ACTIVITY > 0) {
      const cutoff = new Date(Date.now() - MIN_DAYS_SINCE_ACTIVITY * 86_400_000);
      const [recent] = await db.select({ id: activitiesTable.id })
        .from(activitiesTable)
        .where(and(
          eq(activitiesTable.leadId, l.id),
          gte(activitiesTable.createdAt, cutoff),
        ))
        .orderBy(desc(activitiesTable.createdAt))
        .limit(1);
      if (recent) continue;
    }

    const wa = normalizeWa(l.whatsapp ?? l.phone ?? "");
    let autoSent = false;
    let proposedDraft: string | null = null;

    if (level === "fully_automatic" && wa) {
      const account = await defaultAccountForCompany(l.companyId ?? null);
      if (account) {
        const customerName = l.contactPerson || l.leadName || "there";
        const previewBody = leadFollowupBody(l);
        // Generate the AI draft alongside the templated send so we can log
        // model + prompt for traceability of every AI-driven auto-send.
        const aiDraft = await aiDraftLeadFollowup(l);
        const result = await sendWhatsAppTemplate({
          account,
          toWa: wa,
          templateName: FOLLOWUP_TEMPLATE_NAME,
          templateLanguage: FOLLOWUP_TEMPLATE_LANG,
          bodyParams: [customerName, l.requirementType ?? "your enquiry", l.leadNumber],
          previewBody,
          leadId: l.id,
          sentByUserId: l.assignedToId,
        });
        if (result.ok) {
          autoSent = true;
          await autoLog("auto_send_followup", "lead", l.id, JSON.stringify({
            channel: "whatsapp",
            toWa: wa,
            waMessageId: result.waMessageId,
            accountId: account.id,
            assigneeId: l.assignedToId,
            automationLevel: level,
            templateName: FOLLOWUP_TEMPLATE_NAME,
            templateLanguage: FOLLOWUP_TEMPLATE_LANG,
            templateParams: [customerName, l.requirementType ?? "your enquiry", l.leadNumber],
            previewBody,
            model: aiDraft ? aiModelName() : null,
            prompt: aiDraft?.prompt ?? null,
            aiDraft: aiDraft?.text ?? null,
          }));
        } else {
          await autoLog("auto_send_followup_failed", "lead", l.id, JSON.stringify({
            channel: "whatsapp",
            toWa: wa,
            error: result.error,
            templateName: FOLLOWUP_TEMPLATE_NAME,
            templateLanguage: FOLLOWUP_TEMPLATE_LANG,
            previewBody,
            model: aiDraft ? aiModelName() : null,
            prompt: aiDraft?.prompt ?? null,
            aiDraft: aiDraft?.text ?? null,
          }));
        }
      }
    } else if (level === "auto_with_approval") {
      // Generate a draft for the assignee to review, attach to notification.
      const aiDraft = await aiDraftLeadFollowup(l);
      proposedDraft = aiDraft?.text ?? leadFollowupBody(l);
      await autoLog("draft_followup_for_approval", "lead", l.id, JSON.stringify({
        channel: "whatsapp",
        toWa: wa || null,
        assigneeId: l.assignedToId,
        automationLevel: level,
        model: aiDraft ? aiModelName() : null,
        prompt: aiDraft?.prompt ?? null,
        messageBody: proposedDraft,
      }));
    }

    const title = autoSent
      ? `Auto-sent follow-up to ${l.leadName}`
      : level === "auto_with_approval"
        ? `Approve follow-up draft: ${l.leadName}`
        : `Overdue follow-up: ${l.leadName}`;
    const message = autoSent
      ? `WhatsApp follow-up was auto-sent (next-follow-up was ${l.nextFollowUp}).`
      : proposedDraft
        ? `Lead ${l.leadNumber} — next follow-up was ${l.nextFollowUp}. Proposed message:\n\n${proposedDraft}`
        : `Lead ${l.leadNumber} — next follow-up was ${l.nextFollowUp}. Please reach out today.`;
    await notify(l.assignedToId, title, message, "lead", l.id, autoSent ? "success" : "warning");
  }
}

async function scanInvoices(): Promise<void> {
  const today = todayKey();
  const invs = await db.select().from(taxInvoicesTable);
  for (const inv of invs) {
    if (inv.status === "cancelled") continue;
    if (inv.paymentStatus === "paid") continue;
    const balance = (inv.balance ?? 0) || (inv.grandTotal - (inv.amountPaid ?? 0));
    if (balance <= 0) continue;

    // Treat invoice as due 30 days after invoiceDate (UAE standard NET-30)
    // since this schema does not carry an explicit due_date column.
    if (!inv.invoiceDate) continue;
    const dueMs = Date.parse(inv.invoiceDate) + 30 * 86_400_000;
    const days = Math.floor((Date.parse(today) - dueMs) / 86_400_000);
    if (days < 0) continue;
    // Throttle: only on days 0, 7, 14, 21 past due to avoid spam.
    if (days % 7 !== 0) continue;

    // Find the responsible salesperson via the linked project, else any
    // company_admin in scope. We notify; we don't auto-message customers
    // for invoices unless their assignee is fully_automatic.
    let userId: number | null = null;
    let companyId: number | null = inv.companyId ?? null;

    // Best-effort: pick any active super_admin / company_admin for this company.
    const candidates = await db.select().from(usersTable).where(eq(usersTable.isActive, true));
    const match = candidates.find(u => u.companyId === companyId && (u.permissionLevel === "company_admin" || u.permissionLevel === "super_admin"))
      ?? candidates.find(u => u.permissionLevel === "super_admin");
    if (match) userId = match.id;
    if (!userId) continue;

    const level = await getAutomationLevel(userId);
    // Same semantics as scanLeads: cron only acts for auto_with_approval and
    // fully_automatic. "suggest" remains an on-demand UI affordance.
    if (level !== "auto_with_approval" && level !== "fully_automatic") continue;

    // Resolve a customer phone number for outbound messaging. The tax-invoice
    // schema doesn't carry one, so look it up from the linked quotation.
    let customerWa = "";
    if (inv.quotationId) {
      const [q] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, inv.quotationId));
      customerWa = normalizeWa(q?.clientPhone ?? "");
    }

    // Generate the AI draft (with prompt) so we can log model+prompt for
    // every AI-driven invoice action — both the rep notification and
    // any auto-send to the customer.
    const aiDraft = await aiDraftInvoiceFollowup(inv, days);
    const draft = aiDraft?.text ?? invoiceFollowupBody(inv, days);

    let autoSent = false;
    let waMessageId: string | null = null;
    let sendError: string | null = null;

    if (level === "fully_automatic" && customerWa) {
      const account = await defaultAccountForCompany(inv.companyId ?? null);
      if (account) {
        const balanceStr = Number(balance).toLocaleString();
        const result = await sendWhatsAppTemplate({
          account,
          toWa: customerWa,
          templateName: FOLLOWUP_TEMPLATE_NAME,
          templateLanguage: FOLLOWUP_TEMPLATE_LANG,
          bodyParams: [inv.clientName, inv.invoiceNumber, `AED ${balanceStr} (${days}d overdue)`],
          previewBody: draft,
          sentByUserId: userId,
        });
        autoSent = result.ok;
        waMessageId = result.waMessageId;
        if (!result.ok) sendError = result.error ?? null;
      }
    }

    const noticeBody = autoSent
      ? `${inv.clientName} — AED ${Number(balance).toLocaleString()} is ${days} day${days === 1 ? "" : "s"} past the 30-day term. Auto-sent reminder via WhatsApp.\n\nMessage preview:\n${draft}`
      : `${inv.clientName} — AED ${Number(balance).toLocaleString()} is ${days} day${days === 1 ? "" : "s"} past the 30-day term.\n\nDraft message:\n${draft}`;

    await notify(
      userId,
      `Overdue invoice: ${inv.invoiceNumber}`,
      noticeBody,
      "tax_invoice",
      inv.id,
      autoSent ? "success" : "warning",
    );
    await autoLog(autoSent ? "auto_send_invoice_followup" : "scan_overdue_invoice", "tax_invoice", inv.id, JSON.stringify({
      days,
      balance,
      assigneeId: userId,
      automationLevel: level,
      model: aiDraft ? aiModelName() : null,
      prompt: aiDraft?.prompt ?? null,
      draft,
      channel: autoSent ? "whatsapp" : null,
      toWa: customerWa || null,
      waMessageId,
      templateName: autoSent ? FOLLOWUP_TEMPLATE_NAME : null,
      templateLanguage: autoSent ? FOLLOWUP_TEMPLATE_LANG : null,
      sendError,
    }));
  }
}

function invoiceFollowupBody(inv: typeof taxInvoicesTable.$inferSelect, days: number): string {
  const balance = (inv.balance ?? 0) || (inv.grandTotal - (inv.amountPaid ?? 0));
  return `Hi ${inv.clientName}, this is a friendly reminder from Prime Max & Elite Prefab regarding invoice ${inv.invoiceNumber} (AED ${Number(balance).toLocaleString()}), now ${days} day${days === 1 ? "" : "s"} past the 30-day term. Could you please advise on the expected payment date? Happy to share a copy of the invoice if helpful.`;
}

async function aiDraftInvoiceFollowup(inv: typeof taxInvoicesTable.$inferSelect, days: number): Promise<{ text: string; prompt: string } | null> {
  if (!aiAvailable()) return null;
  const balance = (inv.balance ?? 0) || (inv.grandTotal - (inv.amountPaid ?? 0));
  const system = "You are an accounts-receivable assistant at Prime Max & Elite Prefab (UAE prefab construction). Draft a polite, concise (<70 words) WhatsApp follow-up to a customer about an overdue invoice. Tone: professional, courteous, no pressure tactics. Output only the message body.";
  const ctx = [
    `Customer: ${inv.clientName}`,
    `Invoice: ${inv.invoiceNumber}`,
    `Balance due: AED ${Number(balance).toLocaleString()}`,
    `Days overdue (vs 30-day term): ${days}`,
    inv.invoiceDate ? `Invoice date: ${inv.invoiceDate}` : "",
  ].filter(Boolean).join("\n");
  try {
    const text = await chat([
      { role: "system", content: system },
      { role: "user", content: ctx },
    ], { maxCompletionTokens: 300 });
    return { text, prompt: ctx };
  } catch (err) {
    logger.warn({ err, invoiceId: inv.id }, "AI draft failed for overdue invoice");
    return null;
  }
}

async function tick(): Promise<void> {
  try {
    await scanLeads();
    await scanInvoices();
  } catch (err) {
    logger.warn({ err }, "follow-up worker tick failed");
  }
}

let started = false;
export function startFollowUpWorker(): void {
  if (started) return;
  started = true;
  logger.info({ intervalMs: SCAN_INTERVAL_MS }, "Starting follow-up cron worker");
  setTimeout(() => {
    void tick();
    setInterval(() => { void tick(); }, SCAN_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}
