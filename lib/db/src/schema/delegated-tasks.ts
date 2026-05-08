import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const delegatedTasksTable = pgTable("delegated_tasks", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  grantedByUserId: integer("granted_by_user_id").notNull(),
  grantedToUserId: integer("granted_to_user_id").notNull(),
  taskType: text("task_type").notNull(),
  taskLabel: text("task_label").notNull(),
  leadId: integer("lead_id"),
  durationMinutes: integer("duration_minutes").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  status: text("status").notNull().default("pending"),
  completedAt: timestamp("completed_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDelegatedTaskSchema = createInsertSchema(delegatedTasksTable).omit({
  id: true, createdAt: true, completedAt: true, revokedAt: true, status: true, expiresAt: true,
});

export type DelegatedTask = typeof delegatedTasksTable.$inferSelect;
export type InsertDelegatedTask = z.infer<typeof insertDelegatedTaskSchema>;
