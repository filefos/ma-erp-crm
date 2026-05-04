import { pgTable, serial, text, timestamp, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quotationsTable = pgTable("quotations", {
  id: serial("id").primaryKey(),
  quotationNumber: text("quotation_number").notNull().unique(),
  companyId: integer("company_id").notNull(),
  clientCode: text("client_code"),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  clientContactPerson: text("client_contact_person"),
  customerTrn: text("customer_trn"),
  projectName: text("project_name"),
  projectLocation: text("project_location"),
  status: text("status").notNull().default("draft"),
  subtotal: doublePrecision("subtotal").default(0),
  discount: doublePrecision("discount").default(0),
  vatPercent: doublePrecision("vat_percent").default(5),
  vatAmount: doublePrecision("vat_amount").default(0),
  grandTotal: doublePrecision("grand_total").default(0),
  paymentTerms: text("payment_terms"),
  deliveryTerms: text("delivery_terms"),
  validity: text("validity"),
  termsConditions: text("terms_conditions"),
  techSpecs: text("tech_specs"),
  additionalItems: text("additional_items"),
  preparedById: integer("prepared_by_id"),
  approvedById: integer("approved_by_id"),
  leadId: integer("lead_id"),
  dealId: integer("deal_id"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quotationItemsTable = pgTable("quotation_items", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull(),
  description: text("description").notNull(),
  quantity: doublePrecision("quantity").notNull().default(1),
  unit: text("unit").notNull().default("nos"),
  rate: doublePrecision("rate").notNull().default(0),
  amount: doublePrecision("amount").notNull().default(0),
  discount: doublePrecision("discount").default(0),
  sortOrder: integer("sort_order").default(0),
});

export const insertQuotationSchema = createInsertSchema(quotationsTable).omit({ id: true, quotationNumber: true, createdAt: true, updatedAt: true });
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;
export type Quotation = typeof quotationsTable.$inferSelect;
export type QuotationItem = typeof quotationItemsTable.$inferSelect;
