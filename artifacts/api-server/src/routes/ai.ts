import { Router, type Request } from "express";
import { db, leadsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, hasPermission, inScope } from "../middlewares/auth";
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

// ===== Suggest next follow-up for a lead =====
router.post("/ai/suggest-followup", async (req, res): Promise<void> => {
  const leadId = req.body?.leadId ? Number(req.body.leadId) : null;
  if (leadId && !(await hasPermission(req.user, "leads", "view"))) {
    res.status(403).json({ error: "Forbidden", message: "Missing leads:view permission" });
    return;
  }
  if (!leadId) {
    res.status(400).json({ error: "Bad request", message: "leadId is required" });
    return;
  }
  if (!aiAvailable()) {
    res.status(503).json({ error: "Service unavailable", message: "AI is not configured" });
    return;
  }
  if ((await callerAutomationLevel(req)) === "off") {
    res.status(403).json({ error: "AI disabled", message: "Your AI automation level is set to Off." });
    return;
  }

  const [l] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
  if (!l) { res.status(404).json({ error: "Lead not found" }); return; }
  if (!inScope(req, l.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }

  const ctxLines = [
    `Lead ${l.leadNumber}: ${l.leadName}${l.companyName ? ` (${l.companyName})` : ""}`,
    `Status: ${l.status} · Score: ${l.leadScore} · Requirement: ${l.requirementType ?? "?"} · Budget: ${l.budget ?? "?"} · Source: ${l.source ?? "?"}`,
  ];
  if (l.nextFollowUp) ctxLines.push(`Next follow-up scheduled: ${l.nextFollowUp}`);
  if (l.notes) ctxLines.push(`Notes: ${l.notes}`);

  const system = [
    "You are a senior sales coach at Prime Max & Elite Prefab.",
    "Given the lead context, propose the next follow-up touchpoint as a JSON object only — no prose, no markdown fence.",
    "JSON shape: { \"recommendedDate\": \"YYYY-MM-DD\", \"channel\": \"call\"|\"email\"|\"meeting\"|\"whatsapp\", \"reason\": string, \"emailSubject\": string, \"emailBody\": string }",
    "Tone: friendly + professional, UAE business context, AED currency. Email body 4-7 short lines. Do not invent prices.",
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

  let parsed: Record<string, unknown> = {};
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { parsed = JSON.parse(jsonMatch[0]); } catch { /* keep raw */ }
  }

  await audit(req, {
    action: "ai_suggest_followup",
    entity: "lead",
    entityId: l.id,
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
