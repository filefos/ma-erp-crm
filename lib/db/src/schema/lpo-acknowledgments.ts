import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lpoAcknowledgmentsTable = pgTable("lpo_acknowledgments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerId: integer("customer_id"),
  quotationNumber: text("quotation_number"),
  lpoNumber: text("lpo_number"),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull().default("application/pdf"),
  fileContent: text("file_content").notNull(),
  fileSize: integer("file_size"),
  uploadDate: text("upload_date"),
  remarks: text("remarks"),
  uploadedById: integer("uploaded_by_id"),
  uploadedByName: text("uploaded_by_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLpoAcknowledgmentSchema = createInsertSchema(lpoAcknowledgmentsTable).extend({
  fileContent: z.string().min(1),
});
