import { pgTable, serial, text, timestamp, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const assetsTable = pgTable("assets", {
  id: serial("id").primaryKey(),
  assetId: text("asset_id").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  purchaseDate: text("purchase_date"),
  purchaseValue: doublePrecision("purchase_value").default(0),
  currentLocation: text("current_location"),
  assignedTo: text("assigned_to"),
  condition: text("condition").default("good"),
  maintenanceDate: text("maintenance_date"),
  status: text("status").notNull().default("active"),
  companyId: integer("company_id").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAssetSchema = createInsertSchema(assetsTable).omit({ id: true, assetId: true, createdAt: true, updatedAt: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assetsTable.$inferSelect;
