import { createHmac, randomBytes } from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function hashPassword(password: string): string {
  const salt = "erp_salt_2026";
  return createHmac("sha256", salt).update(password).digest("hex");
}

export function generateToken(userId: number): string {
  const payload = `${userId}:${Date.now()}:${randomBytes(16).toString("hex")}`;
  const secret = process.env.SESSION_SECRET ?? "erp_secret_key_2026";
  return createHmac("sha256", secret).update(payload).digest("hex") + "." + Buffer.from(payload).toString("base64");
}

export function verifyToken(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const payload = Buffer.from(parts[1], "base64").toString("utf8");
    const [userId] = payload.split(":");
    const id = parseInt(userId, 10);
    if (isNaN(id)) return null;
    return id;
  } catch {
    return null;
  }
}

export async function getUserFromToken(token: string) {
  const userId = verifyToken(token);
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return user ?? null;
}
