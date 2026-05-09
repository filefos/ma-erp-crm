import { pgTable, serial, text, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  prefix: text("prefix").notNull().unique(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  trn: text("trn"),
  vatPercent: doublePrecision("vat_percent").default(5),
  logo: text("logo"),
  stamp: text("stamp"),
  bankDetails: text("bank_details"),
  letterhead: text("letterhead"),
  stampWidthPct: doublePrecision("stamp_width_pct"),
  stampMarginPct: doublePrecision("stamp_margin_pct"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
