// Helpers for surfacing rich Meta WhatsApp Cloud API errors in the UI.
// Server endpoints (POST /whatsapp/send, /whatsapp/send-document,
// /whatsapp/accounts/:id/test) return JSON like:
//   { error, message, code, subcode, type, fbtraceId }
// when Meta rejects the call. This module formats that into a one-line
// toast description so operators can quote the Meta code to support.

interface MetaErrorFields {
  message?: string;
  code?: number;
  subcode?: number;
  type?: string;
  fbtraceId?: string;
}

export function formatWhatsappError(err: unknown): string {
  const data = extractData(err);
  const fallback = err instanceof Error ? err.message : "Unknown error";
  if (!data) return fallback;
  const parts: string[] = [];
  if (data.code != null) parts.push(`code ${data.code}`);
  if (data.subcode != null) parts.push(`subcode ${data.subcode}`);
  if (data.type) parts.push(data.type);
  const tag = parts.length ? `[${parts.join(" · ")}] ` : "";
  return `${tag}${data.message ?? fallback}`;
}

function extractData(err: unknown): MetaErrorFields | null {
  if (!err || typeof err !== "object") return null;
  const rec = err as Record<string, unknown>;
  const data = (rec.data ?? rec) as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object") return null;
  const out: MetaErrorFields = {};
  if (typeof data.message === "string") out.message = data.message;
  if (typeof data.code === "number") out.code = data.code;
  if (typeof data.subcode === "number") out.subcode = data.subcode;
  if (typeof data.type === "string") out.type = data.type;
  if (typeof data.fbtraceId === "string") out.fbtraceId = data.fbtraceId;
  return Object.keys(out).length ? out : null;
}
