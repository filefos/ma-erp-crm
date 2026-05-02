import { pgTable, serial, integer, doublePrecision, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salesTargetsTable = pgTable("sales_targets", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  userId: integer("user_id").notNull(),
  period: text("period").notNull().default("monthly"),
  year: integer("year").notNull(),
  month: integer("month"),
  quarter: integer("quarter"),
  targetAmount: doublePrecision("target_amount").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSalesTargetSchema = createInsertSchema(salesTargetsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertSalesTarget = z.infer<typeof insertSalesTargetSchema>;
export type SalesTarget = typeof salesTargetsTable.$inferSelect;
