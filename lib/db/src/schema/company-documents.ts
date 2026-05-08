import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const companyDocumentsTable = pgTable("company_documents", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  category: text("category").notNull(),
  customName: text("custom_name"),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  fileContent: text("file_content").notNull(),
  fileSize: integer("file_size"),
  revisionNumber: integer("revision_number").notNull().default(0),
  status: text("status").notNull().default("active"),
  remarks: text("remarks"),
  uploadedById: integer("uploaded_by_id"),
  uploadedByName: text("uploaded_by_name"),
  uploadDate: text("upload_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
