import type { Request } from "express";
import { db, auditLogsTable } from "@workspace/db";

export interface AuditOpts {
  action: string;
  entity: string;
  entityId?: number | null;
  details?: string;
  userId?: number | null;
  userName?: string | null;
  ipAddress?: string | null;
}

function clientIp(req: Request | undefined): string | undefined {
  if (!req) return undefined;
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0]!.trim();
  if (Array.isArray(fwd) && fwd.length) return fwd[0]!.split(",")[0]!.trim();
  return req.ip ?? req.socket?.remoteAddress ?? undefined;
}

export async function audit(req: Request | undefined, opts: AuditOpts): Promise<void> {
  try {
    const user = req?.user;
    await db.insert(auditLogsTable).values({
      userId: opts.userId ?? user?.id ?? null,
      userName: opts.userName ?? user?.name ?? null,
      action: opts.action,
      entity: opts.entity,
      entityId: opts.entityId ?? null,
      details: opts.details ?? null,
      ipAddress: opts.ipAddress ?? clientIp(req) ?? null,
    });
  } catch (err) {
    if (req && (req as Request & { log?: { warn: (...a: unknown[]) => void } }).log) {
      (req as Request & { log: { warn: (msg: object, text: string) => void } }).log.warn({ err, opts }, "Failed to write audit log");
    }
  }
}
