import { Router, type Request } from "express";
import { db, leadsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, hasPermission, inScope } from "../middlewares/auth";
import { audit } from "../lib/audit";
import { chat, aiAvailable, aiModelName } from "../lib/ai";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const ANTHROPIC_MODEL = "claude-sonnet-4-6";

async function chatAnthropic(
  systemPrompt: string,
  userContent: string,
  maxTokens = 8192,
): Promise<string> {
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });
  const block = response.content[0];
  return block.type === "text" ? block.text.trim() : "";
}

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

// ===== Accounts AI helpers (UAE VAT) — Anthropic-backed =====
async function runAccountsAI(req: Request, res: any, system: string, user: string, action: string): Promise<void> {
  if ((await callerAutomationLevel(req)) === "off") {
    res.status(403).json({ error: "AI disabled", message: "Your AI automation level is set to Off." });
    return;
  }
  let raw: string;
  try {
    raw = await chatAnthropic(system, user, 8192);
  } catch (err) {
    req.log?.warn({ err }, "Anthropic accounts AI error");
    res.status(502).json({ error: "AI error", message: err instanceof Error ? err.message : "Unknown" });
    return;
  }
  await audit(req, {
    action,
    entity: "accounts_ai",
    entityId: 0,
    details: JSON.stringify({
      model: ANTHROPIC_MODEL,
      systemPrompt: trimForAudit(system, 1000),
      userPrompt: trimForAudit(user),
      response: trimForAudit(raw),
    }),
  });
  res.json({ result: raw, model: ANTHROPIC_MODEL });
}

router.post("/ai/accounts/categorize-expenses", async (req, res): Promise<void> => {
  if (!(await hasPermission(req.user, "expenses", "view"))) {
    res.status(403).json({ error: "Forbidden", message: "Missing expenses:view permission" }); return;
  }
  const expenses = Array.isArray(req.body?.expenses) ? req.body.expenses.slice(0, 30) : [];
  const lines = expenses.map((e: any, i: number) =>
    `${i + 1}. ${e.expenseNumber ?? "?"} | ${e.category ?? "uncategorised"} | AED ${Number(e.total ?? e.amount ?? 0).toFixed(2)} | ${e.description ?? e.notes ?? ""}`,
  ).join("\n");
  const system = "You are a UAE-based accounting expert using the chart of accounts common to construction and prefab companies. Given a list of expenses, analyse each one and suggest a better GL category if the current one is vague or incorrect. Format: numbered list matching the input. For each item: current category → suggested category + one-line reason. Keep it concise. UAE context, AED currency.";
  const user = `Expenses to review:\n${lines || "(none)"}`;
  await runAccountsAI(req, res, system, user, "ai_accounts_categorize");
});

router.post("/ai/accounts/validate-invoice", async (req, res): Promise<void> => {
  if (!(await hasPermission(req.user, "tax_invoices", "view"))) {
    res.status(403).json({ error: "Forbidden", message: "Missing tax_invoices:view permission" }); return;
  }
  const inv = req.body?.invoice ?? {};
  const lines: string[] = [];
  if (inv.invoiceNumber) lines.push(`Invoice: ${inv.invoiceNumber}`);
  if (inv.subtotal != null) lines.push(`Subtotal: AED ${Number(inv.subtotal).toFixed(2)}`);
  if (inv.vatPercent != null) lines.push(`VAT %: ${inv.vatPercent}%`);
  if (inv.vatAmount != null) lines.push(`VAT Amount: AED ${Number(inv.vatAmount).toFixed(2)}`);
  if (inv.grandTotal != null) lines.push(`Grand Total: AED ${Number(inv.grandTotal).toFixed(2)}`);
  if (inv.clientTrn) lines.push(`Client TRN: ${inv.clientTrn}`);
  if (inv.companyTrn) lines.push(`Company TRN: ${inv.companyTrn}`);
  if (inv.paymentTerms) lines.push(`Payment Terms: ${inv.paymentTerms}`);
  if (inv.items?.length) {
    lines.push(`Line items: ${inv.items.length}`);
    (inv.items as any[]).slice(0, 10).forEach((it: any, i: number) => {
      lines.push(`  ${i + 1}. ${it.description ?? "item"} | qty ${it.quantity ?? 1} | unit AED ${it.unitPrice ?? 0} | VAT% ${it.vatPercent ?? 5}`);
    });
  }
  const system = "You are a UAE FTA-compliant invoice auditor. Check: subtotal + VAT = grand total (flag discrepancies), TRN format (15 digits), VAT % correctness per line, and missing mandatory fields. Return a short audit report: ✅ Pass or ⚠️ Issue for each check, then a summary verdict.";
  const user = lines.length ? lines.join("\n") : "No invoice data provided.";
  await runAccountsAI(req, res, system, user, "ai_accounts_validate_invoice");
});

router.post("/ai/accounts/suggest-journal", async (req, res): Promise<void> => {
  if (!(await hasPermission(req.user, "expenses", "view"))) {
    res.status(403).json({ error: "Forbidden", message: "Missing expenses:view permission" }); return;
  }
  const doc = req.body?.doc ?? {};
  const docType = String(req.body?.docType ?? "expense");
  const docLines: string[] = [];
  if (doc.expenseNumber) docLines.push(`Reference: ${doc.expenseNumber}`);
  if (doc.invoiceNumber) docLines.push(`Reference: ${doc.invoiceNumber}`);
  if (doc.category) docLines.push(`Category: ${doc.category}`);
  if (doc.amount != null) docLines.push(`Amount (excl. VAT): AED ${Number(doc.amount).toFixed(2)}`);
  if (doc.vatAmount != null) docLines.push(`VAT Amount: AED ${Number(doc.vatAmount).toFixed(2)}`);
  if (doc.total != null) docLines.push(`Total: AED ${Number(doc.total).toFixed(2)}`);
  if (doc.paymentDate) docLines.push(`Date: ${doc.paymentDate}`);
  if (doc.notes) docLines.push(`Notes: ${doc.notes}`);
  const system = "You are a UAE-based management accountant. Given a source document, produce a balanced double-entry journal entry in markdown table format. Columns: Account | Debit (AED) | Credit (AED). Use standard UAE chart of accounts accounts (e.g. Accounts Receivable, Revenue, VAT Output, VAT Input, Bank, Cash, Expense Account). End with a one-line narration.";
  const user = `Document type: ${docType}\n${docLines.join("\n") || "No details provided."}`;
  await runAccountsAI(req, res, system, user, "ai_accounts_suggest_journal");
});

router.post("/ai/accounts/vat-check", async (req, res): Promise<void> => {
  if (!(await hasPermission(req.user, "expenses", "view"))) {
    res.status(403).json({ error: "Forbidden", message: "Missing expenses:view permission" }); return;
  }
  const summary = req.body?.summary ?? {};
  const ctx = [
    `Input VAT (paid): AED ${Number(summary.inputVat ?? 0).toFixed(2)}`,
    `Estimated Output VAT (5% of received): AED ${Number(summary.estimatedOutputVat ?? 0).toFixed(2)}`,
    `Net VAT position: AED ${(Number(summary.estimatedOutputVat ?? 0) - Number(summary.inputVat ?? 0)).toFixed(2)}`,
    `Total expense records: ${summary.expenseCount ?? 0}`,
  ].join("\n");
  const system = "You are a UAE FTA VAT compliance advisor. Given a VAT summary, flag any compliance risks and give 3-5 actionable recommendations. Include: filing deadline reminders, TRN verification advice, input VAT recovery tips, and zero-rate category guidance. Be direct and practical. UAE context.";
  const user = `VAT summary:\n${ctx}`;
  await runAccountsAI(req, res, system, user, "ai_accounts_vat_check");
});

// ===== Global Ask-AI assistant (used by every module) =====
// Body: { module: string, question: string, context?: object|string, history?: ChatMessage[] }
// Response: { result: string, model: string }
const MODULE_GUIDANCE: Record<string, string> = {
  crm:         "You assist with Contacts and Leads. Suggest company info from names, spot duplicates, recommend lead priority and follow-up dates.",
  sales:       "You assist with Sales — quotations, proforma, LPOs. Suggest items, pricing from past data, flag low-profit deals, recommend next follow-up.",
  procurement: "You assist with Procurement. Suggest suppliers, recommend best price, compare quotations, alert on high-cost purchases.",
  inventory:   "You assist with Inventory. Predict low stock, suggest reorder quantities, detect dead stock, highlight fast movers.",
  projects:    "You assist with Projects. Track progress, suggest resource allocation, alert on delays, compare estimated vs actual cost.",
  accounts:    "You assist with Accounts under UAE VAT. Suggest journal entries, validate VAT calculations, track pending payments, recommend AR follow-ups.",
  assets:      "You assist with Assets. Track usage, suggest maintenance, monitor depreciation, alert on asset issues.",
  hr:          "You assist with HR — employees, attendance, leaves, payroll. Be careful with sensitive personal data.",
  reports:     "You assist with reports and dashboards. Summarise trends, highlight outliers, suggest follow-up questions.",
  general:     "You are a general ERP assistant for Prime Max & Elite Prefab.",
};

const MODULE_PERMISSION: Record<string, string> = {
  crm: "leads", sales: "quotations", procurement: "purchase_orders", inventory: "items",
  projects: "projects", accounts: "tax_invoices", assets: "assets", hr: "employees", reports: "dashboard",
};

router.post("/ai/ask", async (req, res): Promise<void> => {
  const moduleId = String(req.body?.module ?? "general").toLowerCase();
  const question = String(req.body?.question ?? req.body?.message ?? "").trim();
  const ctx = req.body?.context;
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [];

  if (!question) {
    res.status(400).json({ error: "Bad request", message: "question is required" }); return;
  }
  if (!aiAvailable()) {
    res.status(503).json({ error: "Service unavailable", message: "AI is not configured" }); return;
  }
  if ((await callerAutomationLevel(req)) === "off") {
    res.status(403).json({ error: "AI disabled", message: "Your AI automation level is set to Off." }); return;
  }
  const permKey = MODULE_PERMISSION[moduleId];
  if (permKey && !(await hasPermission(req.user, permKey, "view"))) {
    res.status(403).json({ error: "Forbidden", message: `You don't have access to the ${moduleId} module.` }); return;
  }

  const guidance = MODULE_GUIDANCE[moduleId] ?? MODULE_GUIDANCE.general;
  const system = [
    "You are PRIME ERP's AI assistant for Prime Max & Elite Prefab (UAE).",
    guidance,
    "Hard rules:",
    "- Never invent data. If something isn't in the supplied context, say you don't know.",
    "- Never claim to have changed data. You only suggest — the user must approve in the UI.",
    "- Be concise. Use short bullets and AED for currency.",
  ].join("\n");

  const ctxStr = ctx == null ? "" : (typeof ctx === "string" ? ctx : JSON.stringify(ctx)).slice(0, 4000);
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
  ];
  for (const m of history) {
    if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
      messages.push({ role: m.role, content: String(m.content).slice(0, 2000) });
    }
  }
  messages.push({
    role: "user",
    content: ctxStr ? `Context:\n${ctxStr}\n\nQuestion: ${question}` : question,
  });

  let raw: string;
  try {
    raw = await chat(messages, { maxCompletionTokens: 900 });
  } catch (err) {
    res.status(502).json({ error: "AI error", message: err instanceof Error ? err.message : "Unknown" });
    return;
  }
  if (!raw || !raw.trim()) {
    raw = "I couldn't generate a suggestion for that. Try rephrasing or providing more context.";
  }

  await audit(req, {
    action: "ai_ask",
    entity: "ai_assistant",
    entityId: 0,
    details: JSON.stringify({
      module: moduleId,
      model: aiModelName(),
      question: trimForAudit(question, 1000),
      contextChars: ctxStr.length,
      response: trimForAudit(raw),
    }),
  });

  res.json({ result: raw, model: aiModelName() });
});

export default router;
