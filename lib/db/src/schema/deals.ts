import { pgTable, serial, text, timestamp, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dealsTable = pgTable("deals", {
  id: serial("id").primaryKey(),
  dealNumber: text("deal_number").notNull().unique(),
  title: text("title").notNull(),
  clientName: text("client_name"),
  value: doublePrecision("value").default(0),
  stage: text("stage").notNull().default("new"),
  probability: doublePrecision("probability").default(0),
  expectedCloseDate: text("expected_close_date"),
  assignedToId: integer("assigned_to_id"),
  companyId: integer("company_id"),
  leadId: integer("lead_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDealSchema = createInsertSchema(dealsTable).omit({ id: true, dealNumber: true, createdAt: true, updatedAt: true });
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof dealsTable.$inferSelect;
