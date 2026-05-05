import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userActivitySessionsTable = pgTable("user_activity_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  companyId: integer("company_id"),
  uniqueUserId: text("unique_user_id"),
  loginAt: timestamp("login_at").notNull().defaultNow(),
  logoutAt: timestamp("logout_at"),
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  activeSeconds: integer("active_seconds").notNull().default(0),
  idleSeconds: integer("idle_seconds").notNull().default(0),
  focusLostCount: integer("focus_lost_count").notNull().default(0),
  sessionKey: text("session_key"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserActivitySessionSchema = createInsertSchema(userActivitySessionsTable).omit({ id: true, createdAt: true });
export type InsertUserActivitySession = z.infer<typeof insertUserActivitySessionSchema>;
export type UserActivitySession = typeof userActivitySessionsTable.$inferSelect;
