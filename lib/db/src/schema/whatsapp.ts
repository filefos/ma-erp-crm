import { pgTable, serial, text, boolean, timestamp, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const whatsappAccountsTable = pgTable("whatsapp_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phoneNumberId: text("phone_number_id").notNull().unique(),
  wabaId: text("waba_id"),
  displayPhone: text("display_phone"),
  // Name of the env var that holds the long-lived access token. Tokens are
  // never persisted in the database — only the env-var reference is.
  accessTokenEnv: text("access_token_env").notNull().default("WHATSAPP_ACCESS_TOKEN"),
  companyId: integer("company_id"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const whatsappThreadsTable = pgTable("whatsapp_threads", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  // Counter-party WhatsApp ID (digits only, no '+').
  peerWaId: text("peer_wa_id").notNull(),
  peerName: text("peer_name"),
  leadId: integer("lead_id"),
  dealId: integer("deal_id"),
  contactId: integer("contact_id"),
  projectId: integer("project_id"),
  lastMessageAt: timestamp("last_message_at"),
  lastMessagePreview: text("last_message_preview"),
  lastDirection: text("last_direction"),
  unreadCount: integer("unread_count").notNull().default(0),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const whatsappMessagesTable = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull(),
  accountId: integer("account_id").notNull(),
  // 'in' for inbound (from customer), 'out' for outbound (from us).
  direction: text("direction").notNull(),
  // Provider id ("wamid.xxx"). Used for de-duping webhook events.
  waMessageId: text("wa_message_id"),
  fromWa: text("from_wa"),
  toWa: text("to_wa"),
  // 'text' | 'template' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'reaction' | 'location' | 'contacts' | 'unsupported'
  messageType: text("message_type").notNull().default("text"),
  body: text("body"),
  mediaUrl: text("media_url"),
  mediaCaption: text("media_caption"),
  templateName: text("template_name"),
  templateLanguage: text("template_language"),
  templateVars: text("template_vars"),
  // 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'received'
  status: text("status").notNull().default("queued"),
  errorCode: doublePrecision("error_code"),
  errorText: text("error_text"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  receivedAt: timestamp("received_at"),
  sentById: integer("sent_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWhatsappAccountSchema = createInsertSchema(whatsappAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWhatsappThreadSchema = createInsertSchema(whatsappThreadsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessagesTable).omit({ id: true, createdAt: true });

export type WhatsappAccount = typeof whatsappAccountsTable.$inferSelect;
export type WhatsappThread = typeof whatsappThreadsTable.$inferSelect;
export type WhatsappMessage = typeof whatsappMessagesTable.$inferSelect;
export type InsertWhatsappAccount = z.infer<typeof insertWhatsappAccountSchema>;
export type InsertWhatsappThread = z.infer<typeof insertWhatsappThreadSchema>;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
