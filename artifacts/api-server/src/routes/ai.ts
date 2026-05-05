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

// ===== Accounts AI helpers (UAE VAT) =====
async function runAccountsAI(req: Request, res: any, system: string, user: string, action: string): Promise<void> {
  if (!aiAvailable()) {
    res.status(503).json({ error: "Service unavailable", message: "AI is not configured" });
    return;
  }
  if ((await callerAutomationLevel(req)) === "off") {
    res.status(403).json({ error: "AI disabled", message: "Your AI automation level is set to Off." });
    return;
  }
  let raw: string;
  try {
    raw = await chat([
      { role: "system", content: system },
      { role: "user", content: user },
    ], { maxCompletionTokens: 1200 });
  } catch (err) {
    res.status(502).json({ error: "AI error", message: err instanceof Error ? err.message : "Unknown" });
    return;
  }
  await audit(req, {
    action,
    entity: "accounts_ai",
    entityId: 0,
    details: JSON.stringify({
      model: aiModelName(),
      systemPrompt: trimForAudit(system, 1000),
      userPrompt: trimForAudit(user),
      response: trimForAudit(raw),
    }),
  });
  res.json({ result: raw, model: aiModelName() });
}

router.post("/ai/accounts/categorize-expenses", async (req, res): Promise<void> => {
  if (!(await hasPermission(req.user, "expenses", "view"))) {
    res.status(403).json({ error: "Forbidden", message: "Missing expenses:view permission" }); return;
  }
  const expenses = Array.isArray(req.body?.expenses) ? req.body.expenses.slice(0, 50) : [];
  const system = "You are a senior UAE accountant. Suggest the best chart-of-accounts category for each expense. Reply in concise markdown bullet points: '- <expenseNumber> → <suggested category> (reason)'. Use UAE VAT context.";
  const user = `Expenses:\n${expenses.map((e: any, i: number) => `${i+1}. ${e.expenseNumber ?? "?"} | ${e.category ?? "uncategorised"} | AED ${e.total ?? e.amount ?? 0} | ${e.description ?? ""}`).join("\n") || "(none)"}`;
  await runAccountsAI(req, res, system, user, "ai_accounts_categorize");
});

router.post("/ai/accounts/validate-invoice", async (req, res): Promise<void> => {
  if (!(await hasPermission(req.user, "tax_invoices", "view"))) {
    res.status(403).json({ error: "Forbidden", message: "Missing tax_invoices:view permission" }); return;
  }
  const inv = req.body?.invoice ?? {};
  const system = "You are a UAE VAT compliance reviewer. Check the tax invoice for arithmetic correctness (subtotal × VAT% = VAT amount; subtotal + VAT = grand total) and FTA requirements (TRN present, invoice number, supply date, payment terms). Reply in markdown with **PASS** / **WARN** / **FAIL** lines per check.";
  const user = `Tax Invoice:\nNumber: ${inv.invoiceNumber}\nClient: ${inv.clientName} (TRN ${inv.clientTrn ?? "—"})\nCompany TRN: ${inv.companyTrn ?? "—"}\nInvoice Date: ${inv.invoiceDate ?? "—"}\nSupply Date: ${inv.supplyDate ?? "—"}\nPayment Terms: ${inv.paymentTerms ?? "—"}\nSubtotal: ${inv.subtotal}\nVAT %: ${inv.vatPercent}\nVAT Amount: ${inv.vatAmount}\nGrand Total: ${inv.grandTotal}`;
  await runAccountsAI(req, res, system, user, "ai_accounts_validate_invoice");
});

router.post("/ai/accounts/suggest-journal", async (req, res): Promise<void> => {
  if (!(await hasPermission(req.user, "expenses", "view"))) {
    res.status(403).json({ error: "Forbidden", message: "Missing expenses:view permission" }); return;
  }
  const doc = req.body?.doc ?? {};
  const docType = String(req.body?.docType ?? "expense");
  const system = "You are a UAE accountant. Propose a balanced double-entry journal for the supplied document. Reply as a markdown table with columns Account | Debit (AED) | Credit (AED), then a one-line note. Debits must equal credits. Use VAT Input for purchases and VAT Output for sales.";
  const user = `Document type: ${docType}\nPayload: ${JSON.stringify(doc).slice(0, 1500)}`;
  await runAccountsAI(req, res, system, user, "ai_accounts_suggest_journal");
});

router.post("/ai/accounts/vat-check", async (req, res): Promise<void> => {
  if (!(await hasPermission(req.user, "expenses", "view"))) {
    res.status(403).json({ error: "Forbidden", message: "Missing expenses:view permission" }); return;
  }
  const summary = req.body?.summary ?? {};
  const system = "You are a UAE FTA VAT compliance assistant. Review the input/output VAT summary and flag any compliance risks (missing TRN, unusual zero-rated entries, mismatched periods, recoverable VAT issues). Reply in concise markdown with PASS/WARN/FAIL bullets and an action list at the end.";
  const user = `Period summary:\n${JSON.stringify(summary).slice(0, 1500)}`;
  await runAccountsAI(req, res, system, user, "ai_accounts_vat_check");
});

export default router;
