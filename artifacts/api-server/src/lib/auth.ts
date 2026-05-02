import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const BCRYPT_COST = 10;
const JWT_EXPIRES_IN = "7d";

function getSecret(): string {
  const s = process.env.SESSION_SECRET ?? process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET (or JWT_SECRET) must be set and at least 16 chars");
  }
  return s;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (typeof hash !== "string" || hash.length === 0) return false;
  if (hash.startsWith("$2")) {
    return bcrypt.compare(plain, hash);
  }
  return false;
}

export interface JwtPayload {
  uid: number;
  iat?: number;
  exp?: number;
}

export function generateToken(userId: number): string {
  return jwt.sign({ uid: userId }, getSecret(), {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: "HS256",
  });
}

export function verifyToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, getSecret(), { algorithms: ["HS256"] }) as JwtPayload;
    if (typeof payload?.uid !== "number") return null;
    return payload.uid;
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
