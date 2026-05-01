import { pgTable, serial, text, boolean, timestamp, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  leadNumber: text("lead_number").notNull().unique(),
  leadName: text("lead_name").notNull(),
  companyName: text("company_name"),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  location: text("location"),
  source: text("source"),
  requirementType: text("requirement_type"),
  quantity: doublePrecision("quantity"),
  budget: doublePrecision("budget"),
  status: text("status").notNull().default("new"),
  assignedToId: integer("assigned_to_id"),
  notes: text("notes"),
  nextFollowUp: text("next_follow_up"),
  leadScore: text("lead_score").notNull().default("cold"),
  companyId: integer("company_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, leadNumber: true, createdAt: true, updatedAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
