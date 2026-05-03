import { Router } from "express";
import {
  db,
  whatsappAccountsTable,
  whatsappThreadsTable,
  whatsappMessagesTable,
  leadsTable,
  dealsTable,
  contactsTable,
  projectsTable,
} from "@workspace/db";
import { and, eq, sql, desc } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, inScope } from "../middlewares/auth";
import { audit } from "../lib/audit";

const router = Router();
router.use(requireAuth);

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? "v20.0";

function getAccountToken(account: { accessTokenEnv: string }): string | undefined {
  const name = account.accessTokenEnv || "WHATSAPP_ACCESS_TOKEN";
  return process.env[name];
}

function normalizeWa(raw: string | undefined | null): string {
  if (!raw) return "";
  const digits = String(raw).replace(/[^0-9]/g, "");
  return digits;
}

async function defaultAccount(companyId?: number | null) {
  const rows = await db.select().from(whatsappAccountsTable).where(eq(whatsappAccountsTable.isActive, true));
  if (companyId != null) {
    const match = rows.find(r => r.companyId === companyId && r.isDefault) ?? rows.find(r => r.companyId === companyId);
    if (match) return match;
  }
  return rows.find(r => r.isDefault) ?? rows[0];
}

// ==================== ACCOUNTS ====================

router.get("/whatsapp/accounts", requirePermission("whatsapp", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(whatsappAccountsTable).orderBy(desc(whatsappAccountsTable.createdAt));
  rows = scopeFilter(req, rows);
  // Don't expose token values; just whether the env-var is wired.
  const out = rows.map(r => ({
    ...r,
    tokenConfigured: Boolean(getAccountToken(r)),
  }));
  res.json(out);
});

router.post("/whatsapp/accounts", requirePermission("whatsapp", "create"), async (req, res): Promise<void> => {
  const data = req.body ?? {};
  if (!data.phoneNumberId || !data.name) {
    res.status(400).json({ error: "Bad request", message: "name and phoneNumberId are required" });
    return;
  }
  if (data.companyId != null && !inScope(req, Number(data.companyId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (data.isDefault) {
    await db.update(whatsappAccountsTable).set({ isDefault: false }).where(eq(whatsappAccountsTable.isDefault, true));
  }
  const [acc] = await db.insert(whatsappAccountsTable).values({
    name: data.name,
    phoneNumberId: String(data.phoneNumberId),
    wabaId: data.wabaId ?? null,
    displayPhone: data.displayPhone ?? null,
    accessTokenEnv: data.accessTokenEnv || "WHATSAPP_ACCESS_TOKEN",
    companyId: data.companyId ?? null,
    isDefault: Boolean(data.isDefault),
    isActive: data.isActive !== false,
  }).returning();
  await audit(req, { action: "create", entity: "whatsapp_account", entityId: acc.id, details: acc.name });
  res.status(201).json({ ...acc, tokenConfigured: Boolean(getAccountToken(acc)) });
});

router.put("/whatsapp/accounts/:id", requirePermission("whatsapp", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(whatsappAccountsTable).where(eq(whatsappAccountsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  if (req.body?.isDefault) {
    await db.update(whatsappAccountsTable).set({ isDefault: false }).where(eq(whatsappAccountsTable.isDefault, true));
  }
  const [acc] = await db.update(whatsappAccountsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(whatsappAccountsTable.id, id)).returning();
  await audit(req, { action: "update", entity: "whatsapp_account", entityId: id });
  res.json({ ...acc, tokenConfigured: Boolean(getAccountToken(acc)) });
});

router.delete("/whatsapp/accounts/:id", requirePermission("whatsapp", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(whatsappAccountsTable).where(eq(whatsappAccountsTable.id, id));
  if (existing && !scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(whatsappAccountsTable).where(eq(whatsappAccountsTable.id, id));
  await audit(req, { action: "delete", entity: "whatsapp_account", entityId: id });
  res.json({ success: true });
});

// ==================== THREADS ====================

router.get("/whatsapp/threads", requirePermission("whatsapp", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(whatsappThreadsTable).orderBy(sql`COALESCE(${whatsappThreadsTable.lastMessageAt}, ${whatsappThreadsTable.createdAt}) DESC`);
  rows = scopeFilter(req, rows);
  const { search, leadId, dealId, contactId, projectId, accountId } = req.query;
  if (leadId) rows = rows.filter(r => r.leadId === parseInt(leadId as string, 10));
  if (dealId) rows = rows.filter(r => r.dealId === parseInt(dealId as string, 10));
  if (contactId) rows = rows.filter(r => r.contactId === parseInt(contactId as string, 10));
  if (projectId) rows = rows.filter(r => r.projectId === parseInt(projectId as string, 10));
  if (accountId) rows = rows.filter(r => r.accountId === parseInt(accountId as string, 10));
  if (search) {
    const s = String(search).toLowerCase();
    rows = rows.filter(r =>
      r.peerWaId.toLowerCase().includes(s) ||
      (r.peerName ?? "").toLowerCase().includes(s) ||
      (r.lastMessagePreview ?? "").toLowerCase().includes(s),
    );
  }
  res.json(rows);
});

router.get("/whatsapp/threads/:id", requirePermission("whatsapp", "view"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [t] = await db.select().from(whatsappThreadsTable).where(eq(whatsappThreadsTable.id, id));
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [t]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(t);
});

router.put("/whatsapp/threads/:id", requirePermission("whatsapp", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(whatsappThreadsTable).where(eq(whatsappThreadsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const allowed: Record<string, unknown> = {};
  for (const k of ["peerName", "leadId", "dealId", "contactId", "projectId", "unreadCount", "companyId"]) {
    if (k in req.body) allowed[k] = req.body[k];
  }
  // Treat 0 / falsy ids on link fields as explicit clears, so the inbox's
  // "Clear link" action persists null rather than a bogus FK value of 0.
  for (const k of ["leadId", "dealId", "contactId", "projectId"] as const) {
    if (k in allowed && (allowed[k] === 0 || allowed[k] === "")) allowed[k] = null;
  }
  if ("companyId" in allowed && allowed.companyId != null && !inScope(req, Number(allowed.companyId))) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const [t] = await db.update(whatsappThreadsTable).set({ ...allowed, updatedAt: new Date() }).where(eq(whatsappThreadsTable.id, id)).returning();
  await audit(req, { action: "update", entity: "whatsapp_thread", entityId: id });
  res.json(t);
});

router.post("/whatsapp/threads/:id/mark-read", requirePermission("whatsapp", "view"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(whatsappThreadsTable).where(eq(whatsappThreadsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.update(whatsappThreadsTable).set({ unreadCount: 0, updatedAt: new Date() }).where(eq(whatsappThreadsTable.id, id));
  res.json({ success: true });
});

// ==================== MESSAGES ====================

router.get("/whatsapp/threads/:id/messages", requirePermission("whatsapp", "view"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [t] = await db.select().from(whatsappThreadsTable).where(eq(whatsappThreadsTable.id, id));
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [t]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const msgs = await db.select().from(whatsappMessagesTable)
    .where(eq(whatsappMessagesTable.threadId, id))
    .orderBy(whatsappMessagesTable.createdAt);
  res.json(msgs);
});

// ==================== SEND ====================

interface SendBody {
  accountId?: number;
  threadId?: number;
  to?: string;
  body?: string;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: unknown;
  leadId?: number;
  dealId?: number;
  contactId?: number;
  projectId?: number;
}

router.post("/whatsapp/send", requirePermission("whatsapp", "create"), async (req, res): Promise<void> => {
  const data = req.body as SendBody;
  let toWa = normalizeWa(data.to ?? "");
  let thread: typeof whatsappThreadsTable.$inferSelect | undefined;
  if (data.threadId) {
    const [t] = await db.select().from(whatsappThreadsTable).where(eq(whatsappThreadsTable.id, data.threadId));
    if (!t) { res.status(404).json({ error: "Not found", message: "Thread not found" }); return; }
    if (!scopeFilter(req, [t]).length) { res.status(403).json({ error: "Forbidden" }); return; }
    thread = t;
    toWa = t.peerWaId;
  }

  if (!toWa) { res.status(400).json({ error: "Bad request", message: "Recipient phone is required" }); return; }
  if (!data.body && !data.templateName) {
    res.status(400).json({ error: "Bad request", message: "Either body or templateName is required" });
    return;
  }

  const account = data.accountId
    ? (await db.select().from(whatsappAccountsTable).where(eq(whatsappAccountsTable.id, data.accountId)))[0]
    : await defaultAccount(thread?.companyId ?? null);

  if (!account || !account.isActive) {
    res.status(400).json({ error: "Bad request", message: "No active WhatsApp account configured" });
    return;
  }
  if (!scopeFilter(req, [account]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const token = getAccountToken(account);
  if (!token) {
    res.status(503).json({ error: "Service unavailable", message: `Access token env "${account.accessTokenEnv}" is not set` });
    return;
  }

  if (!thread) {
    const [existing] = await db.select().from(whatsappThreadsTable)
      .where(and(eq(whatsappThreadsTable.accountId, account.id), eq(whatsappThreadsTable.peerWaId, toWa)));
    if (existing) {
      thread = existing;
    } else {
      const [t] = await db.insert(whatsappThreadsTable).values({
        accountId: account.id,
        peerWaId: toWa,
        peerName: data.to ?? null,
        leadId: data.leadId ?? null,
        dealId: data.dealId ?? null,
        contactId: data.contactId ?? null,
        projectId: data.projectId ?? null,
        companyId: account.companyId ?? null,
        unreadCount: 0,
      }).returning();
      thread = t;
    }
  }

  // Insert queued message immediately so the thread shows the optimistic state.
  const [queued] = await db.insert(whatsappMessagesTable).values({
    threadId: thread.id,
    accountId: account.id,
    direction: "out",
    fromWa: account.displayPhone ?? null,
    toWa,
    messageType: data.templateName ? "template" : "text",
    body: data.body ?? null,
    templateName: data.templateName ?? null,
    templateLanguage: data.templateLanguage ?? null,
    templateVars: data.templateComponents ? JSON.stringify(data.templateComponents) : null,
    status: "queued",
    sentById: req.user?.id ?? null,
  }).returning();

  // Build Cloud API payload.
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: toWa,
    recipient_type: "individual",
  };
  if (data.templateName) {
    payload.type = "template";
    const template: Record<string, unknown> = {
      name: data.templateName,
      language: { code: data.templateLanguage ?? "en_US" },
    };
    if (data.templateComponents) template.components = data.templateComponents;
    payload.template = template;
  } else {
    payload.type = "text";
    payload.text = { preview_url: false, body: data.body };
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${account.phoneNumberId}/messages`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    await db.update(whatsappMessagesTable).set({
      status: "failed",
      errorText: err instanceof Error ? err.message : "Network error",
    }).where(eq(whatsappMessagesTable.id, queued.id));
    res.status(502).json({ error: "Bad gateway", message: "Failed to reach WhatsApp Cloud API" });
    return;
  }

  const respJson = await response.json().catch(() => ({})) as {
    messages?: Array<{ id: string }>;
    error?: { code?: number; message?: string };
  };

  if (!response.ok) {
    await db.update(whatsappMessagesTable).set({
      status: "failed",
      errorCode: respJson.error?.code ?? response.status,
      errorText: respJson.error?.message ?? `HTTP ${response.status}`,
    }).where(eq(whatsappMessagesTable.id, queued.id));
    res.status(response.status).json({ error: "WhatsApp send failed", message: respJson.error?.message ?? `HTTP ${response.status}` });
    return;
  }

  const waMessageId = respJson.messages?.[0]?.id ?? null;
  const now = new Date();
  const [updated] = await db.update(whatsappMessagesTable).set({
    waMessageId,
    status: "sent",
    sentAt: now,
  }).where(eq(whatsappMessagesTable.id, queued.id)).returning();

  await db.update(whatsappThreadsTable).set({
    lastMessageAt: now,
    lastMessagePreview: (data.body ?? data.templateName ?? "").slice(0, 200),
    lastDirection: "out",
    updatedAt: now,
  }).where(eq(whatsappThreadsTable.id, thread.id));

  await audit(req, { action: "send", entity: "whatsapp_message", entityId: updated.id, details: `to=${toWa} thread=${thread.id}` });

  res.status(201).json({ message: updated, threadId: thread.id, waMessageId });
});

// ==================== TEMPLATES (proxy Meta) ====================

router.get("/whatsapp/templates", requirePermission("whatsapp", "view"), async (req, res): Promise<void> => {
  const { accountId } = req.query;
  const account = accountId
    ? (await db.select().from(whatsappAccountsTable).where(eq(whatsappAccountsTable.id, parseInt(accountId as string, 10))))[0]
    : await defaultAccount();
  if (!account) { res.json([]); return; }
  if (!scopeFilter(req, [account]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!account.wabaId) {
    res.json([]);
    return;
  }
  const token = getAccountToken(account);
  if (!token) {
    res.status(503).json({ error: "Service unavailable", message: `Access token env "${account.accessTokenEnv}" is not set` });
    return;
  }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${account.wabaId}/message_templates?limit=200`;
  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    res.status(502).json({ error: "Bad gateway", message: err instanceof Error ? err.message : "Network error" });
    return;
  }
  const data = await response.json().catch(() => ({})) as { data?: unknown[]; error?: { message?: string } };
  if (!response.ok) {
    res.status(response.status).json({ error: "Meta API error", message: data.error?.message ?? `HTTP ${response.status}` });
    return;
  }
  res.json(data.data ?? []);
});

// ==================== LINK PICKER (look up entities) ====================

router.get("/whatsapp/link-search", requirePermission("whatsapp", "view"), async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").toLowerCase();
  if (!q) { res.json({ leads: [], deals: [], contacts: [], projects: [] }); return; }
  const allLeads = scopeFilter(req, await db.select().from(leadsTable));
  const allDeals = scopeFilter(req, await db.select().from(dealsTable));
  const allContacts = scopeFilter(req, await db.select().from(contactsTable));
  const allProjects = scopeFilter(req, await db.select().from(projectsTable));
  res.json({
    leads: allLeads.filter(l =>
      l.leadName.toLowerCase().includes(q) ||
      (l.companyName ?? "").toLowerCase().includes(q) ||
      (l.leadNumber ?? "").toLowerCase().includes(q),
    ).slice(0, 10).map(l => ({ id: l.id, label: `${l.leadNumber} · ${l.leadName}`, secondary: l.companyName ?? "" })),
    deals: allDeals.filter(d =>
      d.title.toLowerCase().includes(q) ||
      (d.clientName ?? "").toLowerCase().includes(q) ||
      (d.dealNumber ?? "").toLowerCase().includes(q),
    ).slice(0, 10).map(d => ({ id: d.id, label: `${d.dealNumber} · ${d.title}`, secondary: d.clientName ?? "" })),
    contacts: allContacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.companyName ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q),
    ).slice(0, 10).map(c => ({ id: c.id, label: c.name, secondary: c.companyName ?? "" })),
    projects: allProjects.filter(p =>
      p.projectName.toLowerCase().includes(q) ||
      (p.projectNumber ?? "").toLowerCase().includes(q),
    ).slice(0, 10).map(p => ({ id: p.id, label: `${p.projectNumber} · ${p.projectName}`, secondary: p.clientName ?? "" })),
  });
});

export default router;
