// Thin wrapper around the Replit AI Integrations OpenAI proxy.
// Uses fetch directly to avoid pulling the OpenAI SDK into this server bundle.
import { logger } from "./logger";

const BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const DEFAULT_MODEL = process.env.AI_INTEGRATIONS_OPENAI_MODEL ?? "gpt-4o-mini";

export function aiAvailable(): boolean {
  return Boolean(BASE_URL && API_KEY);
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOpts {
  model?: string;
  maxCompletionTokens?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export async function chat(messages: ChatMessage[], opts: ChatOpts = {}): Promise<string> {
  if (!aiAvailable()) {
    throw new Error("AI is not configured (AI_INTEGRATIONS_OPENAI_BASE_URL / _API_KEY missing)");
  }
  const url = `${BASE_URL!.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: opts.model ?? DEFAULT_MODEL,
    messages,
    max_completion_tokens: opts.maxCompletionTokens ?? 800,
  };
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.warn({ err }, "AI proxy network error");
    throw new Error(err instanceof Error ? err.message : "AI proxy network error");
  }
  const data = (await response.json().catch(() => ({}))) as ChatCompletionResponse;
  if (!response.ok) {
    const msg = data.error?.message ?? `HTTP ${response.status}`;
    logger.warn({ status: response.status, msg }, "AI proxy error");
    throw new Error(msg);
  }
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

export const aiModelName = (): string => DEFAULT_MODEL;

// Vision-capable chat. `imageDataUrl` must be a `data:image/...;base64,...` URL.
// Uses the OpenAI integration proxy with multi-modal content blocks.
export async function chatWithVision(
  systemPrompt: string,
  userText: string,
  imageDataUrl: string,
  opts: ChatOpts = {},
): Promise<string> {
  if (!aiAvailable()) {
    throw new Error("AI is not configured (AI_INTEGRATIONS_OPENAI_BASE_URL / _API_KEY missing)");
  }
  const url = `${BASE_URL!.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: opts.model ?? DEFAULT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    max_completion_tokens: opts.maxCompletionTokens ?? 1500,
  };
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.warn({ err }, "AI vision proxy network error");
    throw new Error(err instanceof Error ? err.message : "AI vision proxy network error");
  }
  const data = (await response.json().catch(() => ({}))) as ChatCompletionResponse;
  if (!response.ok) {
    const msg = data.error?.message ?? `HTTP ${response.status}`;
    logger.warn({ status: response.status, msg }, "AI vision proxy error");
    throw new Error(msg);
  }
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
