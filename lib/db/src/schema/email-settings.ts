import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const emailSettingsTable = pgTable("email_settings", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().unique(),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port").default(587),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"),
  smtpFromName: text("smtp_from_name"),
  smtpSecure: text("smtp_secure").default("starttls"),
  imapHost: text("imap_host"),
  imapPort: integer("imap_port").default(993),
  imapUser: text("imap_user"),
  imapPass: text("imap_pass"),
  imapSecure: text("imap_secure").default("ssl"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
