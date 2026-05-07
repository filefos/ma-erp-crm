import { logger } from "./logger";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
  userId: number;
  phone: string;
}

const store = new Map<string, OtpEntry>();

function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt < now) store.delete(key);
  }
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function storeOtp(email: string, userId: number, phone: string): string {
  cleanupExpired();
  const code = generateOtp();
  store.set(email.toLowerCase(), {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    userId,
    phone,
  });
  logger.info({ email, userId }, "OTP generated");
  return code;
}

export type VerifyResult =
  | { ok: true; userId: number }
  | { ok: false; reason: "not_found" | "expired" | "invalid" | "too_many_attempts" };

export function verifyOtp(email: string, code: string): VerifyResult {
  const entry = store.get(email.toLowerCase());
  if (!entry) return { ok: false, reason: "not_found" };
  if (Date.now() > entry.expiresAt) {
    store.delete(email.toLowerCase());
    return { ok: false, reason: "expired" };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(email.toLowerCase());
    return { ok: false, reason: "too_many_attempts" };
  }
  entry.attempts += 1;
  if (entry.code !== code.trim()) {
    return { ok: false, reason: "invalid" };
  }
  store.delete(email.toLowerCase());
  return { ok: true, userId: entry.userId };
}
