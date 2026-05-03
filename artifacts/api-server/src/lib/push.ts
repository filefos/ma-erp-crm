import { db, deviceTokensTable, notificationsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { logger } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoMessage {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority: "high";
  channelId?: string;
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoResponse {
  data?: ExpoTicket[];
  errors?: unknown;
}

function isValidExpoToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

async function sendExpoBatch(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  if (messages.length === 0) return [];
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(messages),
    });
    const json = (await res.json().catch(() => ({}))) as ExpoResponse;
    if (!res.ok) {
      logger.warn({ status: res.status, body: json }, "Expo push HTTP error");
      return [];
    }
    return json.data ?? [];
  } catch (err) {
    logger.warn({ err }, "Expo push request failed");
    return [];
  }
}

/**
 * Send a push notification to all active device tokens for the given users.
 * Tokens that come back with `DeviceNotRegistered` are deactivated so they
 * stop being targeted on subsequent sends.
 */
export async function sendPushToUsers(userIds: number[], payload: PushPayload): Promise<void> {
  const unique = Array.from(new Set(userIds.filter((u): u is number => typeof u === "number")));
  if (unique.length === 0) return;
  const rows = await db.select().from(deviceTokensTable)
    .where(and(eq(deviceTokensTable.isActive, true), inArray(deviceTokensTable.userId, unique)));
  const valid = rows.filter(r => isValidExpoToken(r.token));
  if (valid.length === 0) return;

  const messages: ExpoMessage[] = valid.map(r => ({
    to: r.token,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    priority: "high",
    channelId: "default",
  }));

  // Expo accepts up to 100 per request.
  const chunks: ExpoMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));

  const deadTokens: string[] = [];
  let idx = 0;
  for (const batch of chunks) {
    const tickets = await sendExpoBatch(batch);
    for (const t of tickets) {
      const msg = batch[idx % batch.length];
      idx++;
      if (t.status === "error" && t.details?.error === "DeviceNotRegistered") {
        deadTokens.push(msg.to);
      }
    }
  }

  if (deadTokens.length > 0) {
    try {
      await db.update(deviceTokensTable)
        .set({ isActive: false })
        .where(inArray(deviceTokensTable.token, deadTokens));
    } catch (err) {
      logger.warn({ err }, "Failed to deactivate dead device tokens");
    }
  }
}

/**
 * Persist a notification row and attempt to push it. Both operations are
 * best-effort; failures are logged but do not throw.
 */
export async function notifyUsers(opts: {
  userIds: number[];
  title: string;
  message: string;
  type?: string;
  entityType?: string | null;
  entityId?: number | null;
  data?: Record<string, unknown>;
}): Promise<void> {
  const users = Array.from(new Set(opts.userIds.filter((u): u is number => typeof u === "number")));
  if (users.length === 0) return;
  try {
    await db.insert(notificationsTable).values(users.map(uid => ({
      userId: uid,
      title: opts.title,
      message: opts.message,
      type: opts.type ?? "info",
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
      isRead: false,
    })));
  } catch (err) {
    logger.warn({ err }, "Failed to persist notification rows");
  }
  try {
    await sendPushToUsers(users, {
      title: opts.title,
      body: opts.message,
      data: {
        ...(opts.data ?? {}),
        entityType: opts.entityType ?? null,
        entityId: opts.entityId ?? null,
      },
    });
  } catch (err) {
    logger.warn({ err }, "Push send failed");
  }
}
