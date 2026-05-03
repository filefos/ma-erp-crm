import { pgTable, serial, text, timestamp, integer, doublePrecision, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull().default("staff"),
  designation: text("designation"),
  departmentId: integer("department_id"),
  companyId: integer("company_id").notNull(),
  phone: text("phone"),
  email: text("email"),
  nationality: text("nationality"),
  siteLocation: text("site_location"),
  joiningDate: text("joining_date"),
  // --- Personal details (Task #43) ---
  photoObjectKey: text("photo_object_key"),
  passportNo: text("passport_no"),
  passportExpiry: text("passport_expiry"),
  emiratesIdNo: text("emirates_id_no"),
  emiratesIdExpiry: text("emirates_id_expiry"),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender"),
  maritalStatus: text("marital_status"),
  homeAddress: text("home_address"),
  personalEmail: text("personal_email"),
  personalPhone: text("personal_phone"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  basicSalary: doublePrecision("basic_salary"),
  allowances: doublePrecision("allowances"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  userId: integer("user_id"),
  companyId: integer("company_id"),
  date: text("date").notNull(),
  checkIn: text("check_in"),
  checkOut: text("check_out"),
  checkInAt: timestamp("check_in_at"),
  checkOutAt: timestamp("check_out_at"),
  overtime: doublePrecision("overtime").default(0),
  status: text("status").notNull().default("present"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  accuracyMeters: doublePrecision("accuracy_meters"),
  checkOutLatitude: doublePrecision("check_out_latitude"),
  checkOutLongitude: doublePrecision("check_out_longitude"),
  checkOutAccuracyMeters: doublePrecision("check_out_accuracy_meters"),
  selfieUrl: text("selfie_url"),
  selfieObjectKey: text("selfie_object_key"),
  checkOutSelfieObjectKey: text("check_out_selfie_object_key"),
  source: text("source"),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Per-employee attachments (passport, visa, EID, photo, degree, etc.)
export const employeeAttachmentsTable = pgTable("employee_attachments", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  category: text("category").notNull(),
  fileName: text("file_name").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type"),
  sizeBytes: integer("size_bytes"),
  notes: text("notes"),
  uploadedById: integer("uploaded_by_id"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

// Offer letters (linked to existing employee or candidate snapshot)
export const offerLettersTable = pgTable("offer_letters", {
  id: serial("id").primaryKey(),
  letterNumber: text("letter_number").notNull().unique(),
  companyId: integer("company_id").notNull(),
  templateType: text("template_type").notNull().default("staff"), // staff | labour
  status: text("status").notNull().default("draft"),              // draft | issued | accepted | rejected
  // Employee link OR candidate snapshot
  employeeId: integer("employee_id"),
  candidateName: text("candidate_name").notNull(),
  candidateNationality: text("candidate_nationality"),
  candidatePassportNo: text("candidate_passport_no"),
  candidatePersonalEmail: text("candidate_personal_email"),
  candidatePersonalPhone: text("candidate_personal_phone"),
  designation: text("designation"),
  joiningDate: text("joining_date"),
  basicSalary: doublePrecision("basic_salary"),
  allowances: doublePrecision("allowances"),
  workerType: text("worker_type"), // staff | labor
  notes: text("notes"),
  // Letterhead snapshot — captured at create time so the rendered letter is
  // deterministic even if the company is later renamed.
  letterheadBrand: text("letterhead_brand"),    // "prime" | "elite"
  companyLegalName: text("company_legal_name"), // legal name as of issue
  // Salesman commission module — all optional, only rendered when enabled.
  commissionEnabled: boolean("commission_enabled").default(false),
  commissionTargetAmount: doublePrecision("commission_target_amount"),
  commissionCurrency: text("commission_currency").default("AED"),
  commissionBaseRatePct: doublePrecision("commission_base_rate_pct"),
  commissionBonusPerStepAmount: doublePrecision("commission_bonus_per_step_amount"),
  commissionBonusStepSize: doublePrecision("commission_bonus_step_size"),
  commissionShortfallTier1Pct: doublePrecision("commission_shortfall_tier1_pct"),
  commissionShortfallTier1DeductionPct: doublePrecision("commission_shortfall_tier1_deduction_pct"),
  commissionShortfallTier2Pct: doublePrecision("commission_shortfall_tier2_pct"),
  commissionShortfallTier2DeductionPct: doublePrecision("commission_shortfall_tier2_deduction_pct"),
  commissionNotes: text("commission_notes"),
  // Status-stamps
  issuedAt: timestamp("issued_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  // Versioning: re-issue creates a new row pointing back at the parent
  parentOfferId: integer("parent_offer_id"),
  version: integer("version").notNull().default(1),
  // Convert-to-employee result
  convertedEmployeeId: integer("converted_employee_id"),
  convertedAt: timestamp("converted_at"),
  // Author
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Per-offer-letter attachments (academic certificates, ID copies, etc.).
// Files are stored inline as base64 to avoid a hard dep on object storage and
// keep operations simple. 8 MB per-file cap is enforced server-side.
export const offerLetterAttachmentsTable = pgTable("offer_letter_attachments", {
  id: serial("id").primaryKey(),
  offerLetterId: integer("offer_letter_id").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type"),
  sizeBytes: integer("size_bytes"),
  contentBase64: text("content_base64").notNull(),
  uploadedById: integer("uploaded_by_id"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, employeeId: true, createdAt: true, updatedAt: true });
export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmployeeAttachmentSchema = createInsertSchema(employeeAttachmentsTable).omit({ id: true, uploadedAt: true });
export const insertOfferLetterSchema = createInsertSchema(offerLettersTable).omit({ id: true, letterNumber: true, createdAt: true, updatedAt: true });
export const insertOfferLetterAttachmentSchema = createInsertSchema(offerLetterAttachmentsTable).omit({ id: true, uploadedAt: true });

export type Employee = typeof employeesTable.$inferSelect;
export type Attendance = typeof attendanceTable.$inferSelect;
export type EmployeeAttachment = typeof employeeAttachmentsTable.$inferSelect;
export type OfferLetter = typeof offerLettersTable.$inferSelect;
export type OfferLetterAttachment = typeof offerLetterAttachmentsTable.$inferSelect;
