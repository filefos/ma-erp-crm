import { pgTable, serial, text, timestamp, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dealsTable = pgTable("deals", {
  id: serial("id").primaryKey(),
  dealNumber: text("deal_number").notNull().unique(),
  title: text("title").notNull(),
  clientName: text("client_name"),
  value: doublePrecision("value"),
  stage: text("stage").notNull().default("prospecting"),
  probability: doublePrecision("probability"),
  expectedCloseDate: text("expected_close_date"),
  assignedToId: integer("assigned_to_id"),
  companyId: integer("company_id").notNull(),
  leadId: integer("lead_id"),
  notes: text("notes"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDealSchema = createInsertSchema(dealsTable).omit({ id: true, dealNumber: true, createdAt: true, updatedAt: true });
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof dealsTable.$inferSelect;
