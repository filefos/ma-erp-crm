// Tiny fetch wrapper for the AI endpoints that aren't in the OpenAPI spec
// (kept out of codegen to avoid coupling streaming/dynamic responses to Orval).
function authHeaders(): Record<string, string> {
  const t = localStorage.getItem("erp_token");
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

async function jsonOrThrow<T>(r: Response): Promise<T> {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (data as { message?: string; error?: string }).message
      ?? (data as { error?: string }).error
      ?? `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function aiStatus(): Promise<{ available: boolean; model: string }> {
  const r = await fetch("/api/ai/status", { headers: authHeaders() });
  return jsonOrThrow(r);
}

export interface ExtractedLpo {
  lpoNumber?: string;
  lpoDate?: string;
  clientName?: string;
  lpoValue?: number | string;
  projectRef?: string;
  paymentTerms?: string;
  scope?: string;
  deliverySchedule?: string;
  notes?: string;
}

export async function extractLpoFields(fileBase64: string, contentType: string): Promise<{ extracted: ExtractedLpo }> {
  const r = await fetch("/api/lpos/extract", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ fileBase64, contentType }),
  });
  return jsonOrThrow(r);
}

export async function suggestWhatsAppReply(threadId: number, opts?: { lastN?: number; tone?: string }): Promise<{ draft: string; model: string }> {
  const r = await fetch("/api/whatsapp/suggest-reply", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ threadId, ...opts }),
  });
  return jsonOrThrow(r);
}

export interface FollowUpSuggestion {
  recommendedDate?: string;
  channel?: "whatsapp" | "call" | "email" | "meeting";
  reason?: string;
  whatsappMessage?: string;
  emailSubject?: string;
  emailBody?: string;
  raw?: string;
  model?: string;
}

export async function suggestFollowUp(input: { leadId?: number; dealId?: number }): Promise<FollowUpSuggestion> {
  const r = await fetch("/api/ai/suggest-followup", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return jsonOrThrow(r);
}

export type AutomationLevel = "off" | "suggest" | "auto_with_approval" | "fully_automatic";

export async function getAutomationLevel(): Promise<{ automationLevel: AutomationLevel }> {
  const r = await fetch("/api/ai/automation-level", { headers: authHeaders() });
  return jsonOrThrow(r);
}

export async function setAutomationLevel(level: AutomationLevel): Promise<{ automationLevel: AutomationLevel }> {
  const r = await fetch("/api/ai/automation-level", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ automationLevel: level }),
  });
  return jsonOrThrow(r);
}
