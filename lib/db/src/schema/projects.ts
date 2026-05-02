import { pgTable, serial, text, timestamp, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  projectNumber: text("project_number").notNull().unique(),
  projectName: text("project_name").notNull(),
  clientName: text("client_name").notNull(),
  companyId: integer("company_id").notNull(),
  location: text("location"),
  scope: text("scope"),
  quotationId: integer("quotation_id"),
  lpoId: integer("lpo_id"),
  projectValue: doublePrecision("project_value").default(0),
  stage: text("stage").notNull().default("new_project"),
  productionStatus: text("production_status").default("pending"),
  procurementStatus: text("procurement_status").default("pending"),
  deliveryStatus: text("delivery_status").default("pending"),
  installationStatus: text("installation_status").default("pending"),
  paymentStatus: text("payment_status").default("pending"),
  projectManagerId: integer("project_manager_id"),
  salespersonId: integer("salesperson_id"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  deliveryDate: text("delivery_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, projectNumber: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
