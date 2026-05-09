import { pgTable, serial, text, timestamp, integer, doublePrecision, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const proformaInvoicesTable = pgTable("proforma_invoices", {
  id: serial("id").primaryKey(),
  piNumber: text("pi_number").notNull().unique(),
  companyId: integer("company_id").notNull(),
  clientCode: text("client_code"),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  clientTrn: text("client_trn"),
  companyTrn: text("company_trn"),
  projectName: text("project_name"),
  projectLocation: text("project_location"),
  projectId: integer("project_id"),
  projectRef: text("project_ref"),
  quotationId: integer("quotation_id"),
  lpoId: integer("lpo_id"),
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
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const taxInvoicesTable = pgTable("tax_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  companyId: integer("company_id").notNull(),
  companyTrn: text("company_trn"),
  clientCode: text("client_code"),
  clientName: text("client_name").notNull(),
  clientTrn: text("client_trn"),
  invoiceDate: text("invoice_date"),
  supplyDate: text("supply_date"),
  quotationId: integer("quotation_id"),
  lpoId: integer("lpo_id"),
  projectId: integer("project_id"),
  projectRef: text("project_ref"),
  paymentTerms: text("payment_terms"),
  notes: text("notes"),
  items: text("items").default("[]"),
  subtotal: doublePrecision("subtotal").default(0),
  vatPercent: doublePrecision("vat_percent").default(5),
  vatAmount: doublePrecision("vat_amount").default(0),
  grandTotal: doublePrecision("grand_total").notNull().default(0),
  amountPaid: doublePrecision("amount_paid").default(0),
  balance: doublePrecision("balance").default(0),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  status: text("status").notNull().default("active"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const deliveryNotesTable = pgTable("delivery_notes", {
  id: serial("id").primaryKey(),
  dnNumber: text("dn_number").notNull().unique(),
  companyId: integer("company_id").notNull(),
  clientCode: text("client_code"),
  clientName: text("client_name").notNull(),
  projectName: text("project_name"),
  deliveryLocation: text("delivery_location"),
  vehicleNumber: text("vehicle_number"),
  driverName: text("driver_name"),
  receiverName: text("receiver_name"),
  deliveryDate: text("delivery_date"),
  status: text("status").notNull().default("pending"),
  taxInvoiceId: integer("tax_invoice_id"),
  quotationId: integer("quotation_id"),
  lpoId: integer("lpo_id"),
  projectId: integer("project_id"),
  projectRef: text("project_ref"),
  items: text("items").default("[]"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const lposTable = pgTable("lpos", {
  id: serial("id").primaryKey(),
  lpoNumber: text("lpo_number").notNull().unique(),
  companyId: integer("company_id").notNull(),
  clientCode: text("client_code"),
  clientName: text("client_name").notNull(),
  projectRef: text("project_ref"),
  projectId: integer("project_id"),
  quotationId: integer("quotation_id"),
  lpoDate: text("lpo_date"),
  lpoValue: doublePrecision("lpo_value").notNull().default(0),
  scope: text("scope"),
  deliverySchedule: text("delivery_schedule"),
  paymentTerms: text("payment_terms"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  items: text("items").default("[]"),
  attachments: jsonb("attachments").default([]),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const undertakingLettersTable = pgTable("undertaking_letters", {
  id: serial("id").primaryKey(),
  ulNumber: text("ul_number").notNull().unique(),
  lpoId: integer("lpo_id"),
  companyId: integer("company_id").notNull(),
  clientName: text("client_name").notNull(),
  lpoNumber: text("lpo_number"),
  projectRef: text("project_ref"),
  projectId: integer("project_id"),
  letterDate: text("letter_date"),
  scope: text("scope"),
  commitmentText: text("commitment_text"),
  signedByName: text("signed_by_name"),
  signedDate: text("signed_date"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const handoverNotesTable = pgTable("handover_notes", {
  id: serial("id").primaryKey(),
  honNumber: text("hon_number").notNull().unique(),
  lpoId: integer("lpo_id"),
  companyId: integer("company_id").notNull(),
  clientName: text("client_name").notNull(),
  lpoNumber: text("lpo_number"),
  projectRef: text("project_ref"),
  projectId: integer("project_id"),
  handoverDate: text("handover_date"),
  projectDescription: text("project_description"),
  itemsHandedOver: text("items_handed_over").default("[]"),
  receivedByName: text("received_by_name"),
  receivedByDesignation: text("received_by_designation"),
  clientRepresentative: text("client_representative"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Per-company sequence counter for Client Codes
export const clientCodeSeqsTable = pgTable("client_code_seqs", {
  companyId: integer("company_id").primaryKey(),
  lastSeq: integer("last_seq").notNull().default(0),
});

export const insertProformaInvoiceSchema = createInsertSchema(proformaInvoicesTable).omit({ id: true, piNumber: true, createdAt: true, updatedAt: true });
export const insertTaxInvoiceSchema = createInsertSchema(taxInvoicesTable).omit({ id: true, invoiceNumber: true, createdAt: true, updatedAt: true });
export const insertDeliveryNoteSchema = createInsertSchema(deliveryNotesTable).omit({ id: true, dnNumber: true, createdAt: true, updatedAt: true });
export const insertLpoSchema = createInsertSchema(lposTable).omit({ id: true, lpoNumber: true, createdAt: true, updatedAt: true });
export const insertUndertakingLetterSchema = createInsertSchema(undertakingLettersTable).omit({ id: true, ulNumber: true, createdAt: true, updatedAt: true });
export const insertHandoverNoteSchema = createInsertSchema(handoverNotesTable).omit({ id: true, honNumber: true, createdAt: true, updatedAt: true });

export type ProformaInvoice = typeof proformaInvoicesTable.$inferSelect;
export type TaxInvoice = typeof taxInvoicesTable.$inferSelect;
export type DeliveryNote = typeof deliveryNotesTable.$inferSelect;
export type Lpo = typeof lposTable.$inferSelect;
export type UndertakingLetter = typeof undertakingLettersTable.$inferSelect;
export type HandoverNote = typeof handoverNotesTable.$inferSelect;
