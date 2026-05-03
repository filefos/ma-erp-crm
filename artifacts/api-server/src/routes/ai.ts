import { Router, type Request } from "express";
import {
  db,
  whatsappThreadsTable,
  whatsappMessagesTable,
  leadsTable,
  dealsTable,
  contactsTable,
  projectsTable,
  activitiesTable,
  usersTable,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth, requirePermission, hasPermission, scopeFilter, inScope } from "../middlewares/auth";
import { audit } from "../lib/audit";
import { chat, aiAvailable, aiModelName } from "../lib/ai";

const router = Router();
router.use(requireAuth);

async function callerAutomationLevel(req: Request): Promise<string> {
  const id = req.user?.id;
  if (!id) return "off";
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return (u as { automationLevel?: string | null } | undefined)?.automationLevel ?? "suggest";
}

function trimForAudit(s: string, max = 4000): string {
  return s.length <= max ? s : s.slice(0, max) + `…(+${s.length - max} chars)`;
}

// ===== AI status =====
router.get("/ai/status", async (_req, res): Promise<void> => {
  res.json({ available: aiAvailable(), model: aiModelName() });
});

// ===== Suggest WhatsApp reply for a thread =====
router.post("/whatsapp/suggest-reply", requirePermission("whatsapp", "create"), async (req, res): Promise<void> => {
  const threadId = Number(req.body?.threadId);
  const lastN = Math.min(Math.max(Number(req.body?.lastN ?? 12), 1), 50);
  const tone = String(req.body?.tone ?? "friendly, professional, concise");
  if (!threadId || Number.isNaN(threadId)) {
    res.status(400).json({ error: "Bad request", message: "threadId is required" });
    return;
  }
  const [thread] = await db.select().from(whatsappThreadsTable).where(eq(whatsappThreadsTable.id, threadId));
  if (!thread) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [thread]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!aiAvailable()) {
    res.status(503).json({ error: "Service unavailable", message: "AI is not configured" });
    return;
  }
  if ((await callerAutomationLevel(req)) === "off") {
    res.status(403).json({ error: "AI disabled", message: "Your AI automation level is set to Off. Update it in your profile to use AI suggestions." });
    return;
  }

  // Pull context: last N messages + linked entity snapshot.
  const msgs = await db.select().from(whatsappMessagesTable)
    .where(eq(whatsappMessagesTable.threadId, threadId))
    .orderBy(desc(whatsappMessagesTable.createdAt))
    .limit(lastN);
  msgs.reverse();

  const ctxLines: string[] = [];
  if (thread.leadId) {
    const [l] = await db.select().from(leadsTable).where(eq(leadsTable.id, thread.leadId));
    if (l) ctxLines.push(`Linked lead ${l.leadNumber} — ${l.leadName}${l.companyName ? ` (${l.companyName})` : ""} · status=${l.status} · requirement=${l.requirementType ?? "?"} · budget=${l.budget ?? "?"}`);
  }
  if (thread.dealId) {
    const [d] = await db.select().from(dealsTable).where(eq(dealsTable.id, thread.dealId));
    if (d) ctxLines.push(`Linked deal ${d.dealNumber} — ${d.title} · stage=${d.stage} · value=${d.value} · probability=${d.probability}%`);
  }
  if (thread.contactId) {
    const [c] = await db.select().from(contactsTable).where(eq(contactsTable.id, thread.contactId));
    if (c) ctxLines.push(`Linked contact ${c.name}${c.companyName ? ` (${c.companyName})` : ""}`);
  }
  if (thread.projectId) {
    const [p] = await db.select().from(projectsTable).where(eq(projectsTable.id, thread.projectId));
    if (p) ctxLines.push(`Linked project ${p.projectNumber} — ${p.projectName} · stage=${p.stage} · value=${p.projectValue}`);
  }

  const transcript = msgs.map(m => `${m.direction === "in" ? "CUSTOMER" : "US"}: ${m.body ?? `[${m.messageType}${m.templateName ? " " + m.templateName : ""}]`}`).join("\n");

  const system = [
    "You are a senior sales assistant at Prime Max & Elite Prefab — a UAE prefab construction company.",
    "Draft the next WhatsApp reply on behalf of the salesperson.",
    `Tone: ${tone}. Keep it under 80 words. Use the customer's name when known. Do NOT add sign-offs like 'Best regards'. Do NOT add disclaimers.`,
    "Reply in the same language the customer is using (English / Arabic). Do not invent prices, dates, or specifications you don't see in the context.",
    "Output only the message body — no headers, no quotes around it.",
  ].join("\n");

  const user = [
    ctxLines.length ? `Context:\n${ctxLines.join("\n")}` : "Context: (no linked entity yet)",
    "",
    `Recent conversation (most recent last):\n${transcript || "(no messages yet)"}`,
    "",
    "Draft the next reply we should send.",
  ].join("\n");

  let draft: string;
  try {
    draft = await chat([
      { role: "system", content: system },
      { role: "user", content: user },
    ], { maxCompletionTokens: 400 });
  } catch (err) {
    res.status(502).json({ error: "AI error", message: err instanceof Error ? err.message : "Unknown" });
    return;
  }

  await audit(req, {
    action: "ai_suggest_reply",
    entity: "whatsapp_thread",
    entityId: threadId,
    details: JSON.stringify({
      model: aiModelName(),
      chars: draft.length,
      systemPrompt: trimForAudit(system, 1000),
      userPrompt: trimForAudit(user),
      draft: trimForAudit(draft),
    }),
  });

  res.json({ draft, model: aiModelName() });
});

// ===== Suggest next follow-up for a lead or a deal =====
router.post("/ai/suggest-followup", async (req, res): Promise<void> => {
  const leadId = req.body?.leadId ? Number(req.body.leadId) : null;
  const dealId = req.body?.dealId ? Number(req.body.dealId) : null;
  // Per-entity permission check — leads:view for leadId, deals:view for dealId.
  if (leadId && !(await hasPermission(req.user, "leads", "view"))) {
    res.status(403).json({ error: "Forbidden", message: "Missing leads:view permission" });
    return;
  }
  if (dealId && !(await hasPermission(req.user, "deals", "view"))) {
    res.status(403).json({ error: "Forbidden", message: "Missing deals:view permission" });
    return;
  }
  if (!leadId && !dealId) {
    res.status(400).json({ error: "Bad request", message: "leadId or dealId is required" });
    return;
  }
  if (!aiAvailable()) {
    res.status(503).json({ error: "Service unavailable", message: "AI is not configured" });
    return;
  }
  if ((await callerAutomationLevel(req)) === "off") {
    res.status(403).json({ error: "AI disabled", message: "Your AI automation level is set to Off. Update it in your profile to use AI suggestions." });
    return;
  }

  const ctxLines: string[] = [];
  let lead: typeof leadsTable.$inferSelect | undefined;
  let deal: typeof dealsTable.$inferSelect | undefined;

  if (leadId) {
    const [l] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
    if (!l) { res.status(404).json({ error: "Lead not found" }); return; }
    if (!inScope(req, l.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }
    lead = l;
    ctxLines.push(`Lead ${l.leadNumber}: ${l.leadName}${l.companyName ? ` (${l.companyName})` : ""}`);
    ctxLines.push(`Status: ${l.status} · Score: ${l.leadScore} · Requirement: ${l.requirementType ?? "?"} · Budget: ${l.budget ?? "?"} · Source: ${l.source ?? "?"}`);
    if (l.nextFollowUp) ctxLines.push(`Next follow-up scheduled: ${l.nextFollowUp}`);
    if (l.notes) ctxLines.push(`Notes: ${l.notes}`);
  }
  if (dealId) {
    const [d] = await db.select().from(dealsTable).where(eq(dealsTable.id, dealId));
    if (!d) { res.status(404).json({ error: "Deal not found" }); return; }
    if (!inScope(req, d.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }
    deal = d;
    ctxLines.push(`Deal ${d.dealNumber}: ${d.title}`);
    ctxLines.push(`Stage: ${d.stage} · Value: AED ${d.value} · Probability: ${d.probability}% · Expected close: ${d.expectedCloseDate ?? "?"}`);
    if (d.notes) ctxLines.push(`Notes: ${d.notes}`);
    if (!lead && d.leadId) {
      const [l] = await db.select().from(leadsTable).where(eq(leadsTable.id, d.leadId));
      if (l) lead = l;
    }
  }

  // Latest activities for context.
  const acts = await db.select().from(activitiesTable)
    .where(lead ? eq(activitiesTable.leadId, lead.id) : eq(activitiesTable.dealId, dealId!))
    .orderBy(desc(activitiesTable.createdAt))
    .limit(8);
  if (acts.length) {
    ctxLines.push("Recent activities:");
    for (const a of acts) ctxLines.push(`  · ${a.type} — ${a.subject} (${a.isDone ? "done" : "open"}${a.dueDate ? `, due ${a.dueDate}` : ""})`);
  }

  const system = [
    "You are a senior sales coach at Prime Max & Elite Prefab.",
    "Given the lead/deal context, propose the next follow-up touchpoint as a JSON object only — no prose, no markdown fence.",
    "JSON shape: { \"recommendedDate\": \"YYYY-MM-DD\", \"channel\": \"whatsapp\"|\"call\"|\"email\"|\"meeting\", \"reason\": string, \"whatsappMessage\": string, \"emailSubject\": string, \"emailBody\": string }",
    "Tone: friendly + professional, UAE business context, AED currency. Keep WhatsApp under 80 words. Email body 4-7 short lines. Do not invent prices.",
  ].join("\n");

  const user = ctxLines.join("\n");

  let raw: string;
  try {
    raw = await chat([
      { role: "system", content: system },
      { role: "user", content: user },
    ], { maxCompletionTokens: 800 });
  } catch (err) {
    res.status(502).json({ error: "AI error", message: err instanceof Error ? err.message : "Unknown" });
    return;
  }

  // Try to parse JSON robustly (some models still wrap in fences).
  let parsed: Record<string, unknown> = {};
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { parsed = JSON.parse(jsonMatch[0]); } catch { /* keep raw */ }
  }

  await audit(req, {
    action: "ai_suggest_followup",
    entity: deal ? "deal" : "lead",
    entityId: deal?.id ?? lead?.id ?? null,
    details: JSON.stringify({
      model: aiModelName(),
      systemPrompt: trimForAudit(system, 1000),
      userPrompt: trimForAudit(user),
      response: trimForAudit(raw),
    }),
  });

  res.json({ ...parsed, raw, model: aiModelName() });
});

// ===== Read / update the caller's automation_level =====
router.get("/ai/automation-level", async (req, res): Promise<void> => {
  const id = req.user?.id;
  if (!id) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  res.json({ automationLevel: (u as { automationLevel?: string | null } | undefined)?.automationLevel ?? "suggest" });
});

router.put("/ai/automation-level", async (req, res): Promise<void> => {
  const id = req.user?.id;
  if (!id) { res.status(401).json({ error: "Unauthorized" }); return; }
  const level = String(req.body?.automationLevel ?? "");
  const allowed = new Set(["off", "suggest", "auto_with_approval", "fully_automatic"]);
  if (!allowed.has(level)) {
    res.status(400).json({ error: "Bad request", message: "automationLevel must be off|suggest|auto_with_approval|fully_automatic" });
    return;
  }
  await db.update(usersTable)
    .set({ ...({ automationLevel: level } as Record<string, unknown>), updatedAt: new Date() })
    .where(eq(usersTable.id, id));
  await audit(req, { action: "update", entity: "user_automation_level", entityId: id, details: level });
  res.json({ automationLevel: level });
});

export default router;
