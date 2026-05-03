import { pgTable, serial, text, timestamp, integer, doublePrecision, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const inventoryItemsTable = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  itemCode: text("item_code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").default("nos"),
  currentStock: doublePrecision("current_stock").notNull().default(0),
  openingStock: doublePrecision("opening_stock").default(0),
  minimumStock: doublePrecision("minimum_stock").notNull().default(0),
  unitCost: doublePrecision("unit_cost").default(0),
  warehouseLocation: text("warehouse_location"),
  description: text("description"),
  brand: text("brand"),
  country: text("country"),
  color: text("color"),
  imageUrl: text("image_url"),
  companyId: integer("company_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const stockEntriesTable = pgTable("stock_entries", {
  id: serial("id").primaryKey(),
  entryNumber: text("entry_number").notNull().unique(),
  type: text("type").notNull(),
  itemId: integer("item_id").notNull(),
  quantity: doublePrecision("quantity").notNull(),
  unit: text("unit"),
  unitCost: doublePrecision("unit_cost"),
  reference: text("reference"),
  notes: text("notes"),
  imageUrl: text("image_url"),
  approvalStatus: text("approval_status").notNull().default("pending"),
  approvedById: integer("approved_by_id"),
  createdById: integer("created_by_id"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItemsTable).omit({ id: true, itemCode: true, createdAt: true, updatedAt: true });
export const insertStockEntrySchema = createInsertSchema(stockEntriesTable).omit({ id: true, entryNumber: true, createdAt: true });

export type InventoryItem = typeof inventoryItemsTable.$inferSelect;
export type StockEntry = typeof stockEntriesTable.$inferSelect;
