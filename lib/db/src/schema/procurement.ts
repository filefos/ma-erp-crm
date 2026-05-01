import { pgTable, serial, text, timestamp, integer, doublePrecision, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  trn: text("trn"),
  category: text("category"),
  paymentTerms: text("payment_terms"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const purchaseRequestsTable = pgTable("purchase_requests", {
  id: serial("id").primaryKey(),
  prNumber: text("pr_number").notNull().unique(),
  companyId: integer("company_id").notNull(),
  projectId: integer("project_id"),
  description: text("description").notNull(),
  priority: text("priority").default("normal"),
  status: text("status").notNull().default("pending"),
  requestedById: integer("requested_by_id"),
  approvedById: integer("approved_by_id"),
  requiredDate: text("required_date"),
  items: text("items").default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(),
  supplierId: integer("supplier_id").notNull(),
  companyId: integer("company_id").notNull(),
  purchaseRequestId: integer("purchase_request_id"),
  subtotal: doublePrecision("subtotal").default(0),
  vatAmount: doublePrecision("vat_amount").default(0),
  total: doublePrecision("total").notNull().default(0),
  status: text("status").notNull().default("draft"),
  paymentTerms: text("payment_terms"),
  deliveryDate: text("delivery_date"),
  approvedById: integer("approved_by_id"),
  items: text("items").default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequestsTable).omit({ id: true, prNumber: true, createdAt: true, updatedAt: true });
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrdersTable).omit({ id: true, poNumber: true, createdAt: true, updatedAt: true });

export type Supplier = typeof suppliersTable.$inferSelect;
export type PurchaseRequest = typeof purchaseRequestsTable.$inferSelect;
export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
