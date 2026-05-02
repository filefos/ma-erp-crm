import { pgTable, serial, text, timestamp, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const proformaInvoicesTable = pgTable("proforma_invoices", {
  id: serial("id").primaryKey(),
  piNumber: text("pi_number").notNull().unique(),
  companyId: integer("company_id").notNull(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  projectName: text("project_name"),
  projectLocation: text("project_location"),
  quotationId: integer("quotation_id"),
  subtotal: doublePrecision("subtotal").default(0),
  vatPercent: doublePrecision("vat_percent").default(5),
  vatAmount: doublePrecision("vat_amount").default(0),
  total: doublePrecision("total").notNull().default(0),
  paymentTerms: text("payment_terms"),
  validityDate: text("validity_date"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  items: text("items").default("[]"),
  preparedById: integer("prepared_by_id"),
  approvedById: integer("approved_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const taxInvoicesTable = pgTable("tax_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  companyId: integer("company_id").notNull(),
  companyTrn: text("company_trn"),
  clientName: text("client_name").notNull(),
  clientTrn: text("client_trn"),
  invoiceDate: text("invoice_date"),
  supplyDate: text("supply_date"),
  quotationId: integer("quotation_id"),
  projectId: integer("project_id"),
  subtotal: doublePrecision("subtotal").default(0),
  vatPercent: doublePrecision("vat_percent").default(5),
  vatAmount: doublePrecision("vat_amount").default(0),
  grandTotal: doublePrecision("grand_total").notNull().default(0),
  amountPaid: doublePrecision("amount_paid").default(0),
  balance: doublePrecision("balance").default(0),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const deliveryNotesTable = pgTable("delivery_notes", {
  id: serial("id").primaryKey(),
  dnNumber: text("dn_number").notNull().unique(),
  companyId: integer("company_id").notNull(),
  clientName: text("client_name").notNull(),
  projectName: text("project_name"),
  deliveryLocation: text("delivery_location"),
  vehicleNumber: text("vehicle_number"),
  driverName: text("driver_name"),
  receiverName: text("receiver_name"),
  deliveryDate: text("delivery_date"),
  status: text("status").notNull().default("pending"),
  taxInvoiceId: integer("tax_invoice_id"),
  projectId: integer("project_id"),
  items: text("items").default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const lposTable = pgTable("lpos", {
  id: serial("id").primaryKey(),
  lpoNumber: text("lpo_number").notNull().unique(),
  companyId: integer("company_id").notNull(),
  clientName: text("client_name").notNull(),
  projectId: integer("project_id"),
  quotationId: integer("quotation_id"),
  lpoDate: text("lpo_date"),
  lpoValue: doublePrecision("lpo_value").notNull().default(0),
  scope: text("scope"),
  deliverySchedule: text("delivery_schedule"),
  paymentTerms: text("payment_terms"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProformaInvoiceSchema = createInsertSchema(proformaInvoicesTable).omit({ id: true, piNumber: true, createdAt: true, updatedAt: true });
export const insertTaxInvoiceSchema = createInsertSchema(taxInvoicesTable).omit({ id: true, invoiceNumber: true, createdAt: true, updatedAt: true });
export const insertDeliveryNoteSchema = createInsertSchema(deliveryNotesTable).omit({ id: true, dnNumber: true, createdAt: true, updatedAt: true });
export const insertLpoSchema = createInsertSchema(lposTable).omit({ id: true, lpoNumber: true, createdAt: true, updatedAt: true });

export type ProformaInvoice = typeof proformaInvoicesTable.$inferSelect;
export type TaxInvoice = typeof taxInvoicesTable.$inferSelect;
export type DeliveryNote = typeof deliveryNotesTable.$inferSelect;
export type Lpo = typeof lposTable.$inferSelect;
