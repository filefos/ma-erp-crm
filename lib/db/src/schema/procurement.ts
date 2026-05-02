import { pgTable, serial, text, timestamp, integer, doublePrecision, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  address: text("address"),
  trn: text("trn"),
  website: text("website"),
  category: text("category"),
  paymentTerms: text("payment_terms"),
  bankName: text("bank_name"),
  bankAccountName: text("bank_account_name"),
  bankAccountNumber: text("bank_account_number"),
  iban: text("iban"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const purchaseRequestsTable = pgTable("purchase_requests", {
  id: serial("id").primaryKey(),
  prNumber: text("pr_number").notNull().unique(),
  companyId: integer("company_id").notNull(),
  projectId: integer("project_id"),
  projectRef: text("project_ref"),
  department: text("department"),
  description: text("description").notNull(),
  priority: text("priority").default("medium"),
  status: text("status").notNull().default("draft"),
  requestedById: integer("requested_by_id"),
  approvedById: integer("approved_by_id"),
  rejectionReason: text("rejection_reason"),
  requiredDate: text("required_date"),
  items: text("items").default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const rfqsTable = pgTable("rfqs", {
  id: serial("id").primaryKey(),
  rfqNumber: text("rfq_number").notNull().unique(),
  companyId: integer("company_id").notNull(),
  purchaseRequestId: integer("purchase_request_id"),
  status: text("status").notNull().default("draft"),
  requiredDeliveryDate: text("required_delivery_date"),
  paymentTerms: text("payment_terms"),
  notes: text("notes"),
  items: text("items").default("[]"),
  supplierIds: text("supplier_ids").default("[]"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const supplierQuotationsTable = pgTable("supplier_quotations", {
  id: serial("id").primaryKey(),
  sqNumber: text("sq_number").notNull().unique(),
  companyId: integer("company_id").notNull(),
  rfqId: integer("rfq_id"),
  supplierId: integer("supplier_id").notNull(),
  supplierQuotationRef: text("supplier_quotation_ref"),
  quotationDate: text("quotation_date"),
  subtotal: doublePrecision("subtotal").default(0),
  vatAmount: doublePrecision("vat_amount").default(0),
  total: doublePrecision("total").default(0),
  deliveryTime: text("delivery_time"),
  paymentTerms: text("payment_terms"),
  warranty: text("warranty"),
  notes: text("notes"),
  attachmentUrl: text("attachment_url"),
  status: text("status").notNull().default("received"),
  selectionReason: text("selection_reason"),
  items: text("items").default("[]"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(),
  supplierId: integer("supplier_id").notNull(),
  companyId: integer("company_id").notNull(),
  purchaseRequestId: integer("purchase_request_id"),
  rfqId: integer("rfq_id"),
  supplierQuotationId: integer("supplier_quotation_id"),
  deliveryLocation: text("delivery_location"),
  notes: text("notes"),
  subtotal: doublePrecision("subtotal").default(0),
  vatAmount: doublePrecision("vat_amount").default(0),
  total: doublePrecision("total").notNull().default(0),
  status: text("status").notNull().default("draft"),
  paymentTerms: text("payment_terms"),
  deliveryDate: text("delivery_date"),
  preparedById: integer("prepared_by_id"),
  approvedById: integer("approved_by_id"),
  rejectionReason: text("rejection_reason"),
  items: text("items").default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequestsTable).omit({ id: true, prNumber: true, createdAt: true, updatedAt: true });
export const insertRfqSchema = createInsertSchema(rfqsTable).omit({ id: true, rfqNumber: true, createdAt: true, updatedAt: true });
export const insertSupplierQuotationSchema = createInsertSchema(supplierQuotationsTable).omit({ id: true, sqNumber: true, createdAt: true, updatedAt: true });
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrdersTable).omit({ id: true, poNumber: true, createdAt: true, updatedAt: true });

export type Supplier = typeof suppliersTable.$inferSelect;
export type PurchaseRequest = typeof purchaseRequestsTable.$inferSelect;
export type Rfq = typeof rfqsTable.$inferSelect;
export type SupplierQuotation = typeof supplierQuotationsTable.$inferSelect;
export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
