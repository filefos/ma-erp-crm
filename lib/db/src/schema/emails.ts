import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emailsTable = pgTable("emails", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  folder: text("folder").notNull().default("inbox"),
  fromAddress: text("from_address").notNull(),
  fromName: text("from_name"),
  toAddress: text("to_address").notNull(),
  toName: text("to_name"),
  ccAddress: text("cc_address"),
  bccAddress: text("bcc_address"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  isStarred: boolean("is_starred").notNull().default(false),
  replyToId: integer("reply_to_id"),
  sentAt: timestamp("sent_at"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmailSchema = createInsertSchema(emailsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Email = typeof emailsTable.$inferSelect;
