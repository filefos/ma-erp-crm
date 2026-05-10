import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

// ── Main registration record (created by admin, filled by employee) ──────────
export const employeeRegistrationsTable = pgTable("employee_registrations", {
  id: serial("id").primaryKey(),
  // Unique codes / link
  regCode: text("reg_code").notNull().unique(),         // EMP-2026-0001
  deptRegCode: text("dept_reg_code"),                   // HR-EMP-2026-0001
  token: text("token").notNull().unique(),               // UUID for secure link
  linkActive: boolean("link_active").notNull().default(true),

  // Company / department context
  companyId: integer("company_id").notNull(),
  departmentId: integer("department_id"),
  departmentName: text("department_name"),              // snapshot at create time

  // Status lifecycle
  status: text("status").notNull().default("link_generated"),
  // link_generated | pending | submitted | under_review | correction_required | approved | rejected | active | inactive

  // Basic info (admin fills at creation)
  fullName: text("full_name").notNull(),
  email: text("email"),
  mobile: text("mobile"),
  designation: text("designation"),
  joiningType: text("joining_type"),                    // staff | labour | contractor
  branch: text("branch"),

  // Personal info (employee fills)
  fatherName: text("father_name"),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender"),
  nationality: text("nationality"),
  maritalStatus: text("marital_status"),
  currentAddress: text("current_address"),
  permanentAddress: text("permanent_address"),

  // Location
  currentCountry: text("current_country"),
  currentState: text("current_state"),
  currentCity: text("current_city"),
  homeCountry: text("home_country"),
  homeState: text("home_state"),
  homeCity: text("home_city"),

  // Emergency contact
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactNumber: text("emergency_contact_number"),
  emergencyContactRelationship: text("emergency_contact_relationship"),

  // Employment info (employee fills)
  expectedJoiningDate: text("expected_joining_date"),
  visaStatus: text("visa_status"),
  uaeDrivingLicense: text("uae_driving_license"),       // yes | no | expired
  totalExperienceYears: text("total_experience_years"),
  gulfExperienceYears: text("gulf_experience_years"),
  homeCountryExperienceYears: text("home_country_experience_years"),
  previousCompany: text("previous_company"),
  previousDesignation: text("previous_designation"),
  previousCompanyLocation: text("previous_company_location"),
  reasonForLeaving: text("reason_for_leaving"),
  skillsCategory: text("skills_category"),
  salaryExpectation: text("salary_expectation"),

  // Admin fields
  adminRemarks: text("admin_remarks"),
  correctionNotes: text("correction_notes"),

  // Timestamps
  submittedAt: timestamp("submitted_at"),
  reviewedAt: timestamp("reviewed_at"),
  approvedAt: timestamp("approved_at"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Documents ────────────────────────────────────────────────────────────────
export const employeeRegDocumentsTable = pgTable("employee_reg_documents", {
  id: serial("id").primaryKey(),
  registrationId: integer("registration_id").notNull(),
  documentType: text("document_type").notNull(),
  documentName: text("document_name").notNull(),
  // File stored as base64 data URL
  fileData: text("file_data"),
  fileName: text("file_name"),
  contentType: text("content_type"),
  fileSizeBytes: integer("file_size_bytes"),
  // Metadata
  expiryDate: text("expiry_date"),
  status: text("status").notNull().default("submitted"),
  // submitted | pending | not_applicable | expired | verified | rejected
  required: boolean("required").notNull().default(false),
  adminRemarks: text("admin_remarks"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  verifiedAt: timestamp("verified_at"),
  verifiedById: integer("verified_by_id"),
});

// ── Experience records ───────────────────────────────────────────────────────
export const employeeRegExperienceTable = pgTable("employee_reg_experience", {
  id: serial("id").primaryKey(),
  registrationId: integer("registration_id").notNull(),
  companyName: text("company_name").notNull(),
  country: text("country"),
  city: text("city"),
  designation: text("designation"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  totalDuration: text("total_duration"),
  reasonForLeaving: text("reason_for_leaving"),
  jobResponsibilities: text("job_responsibilities"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Education records ────────────────────────────────────────────────────────
export const employeeRegEducationTable = pgTable("employee_reg_education", {
  id: serial("id").primaryKey(),
  registrationId: integer("registration_id").notNull(),
  certificateName: text("certificate_name").notNull(),
  instituteName: text("institute_name"),
  country: text("country"),
  passingYear: text("passing_year"),
  grade: text("grade"),
  fileData: text("file_data"),
  fileName: text("file_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Relatives / emergency contact docs ──────────────────────────────────────
export const employeeRegRelativesTable = pgTable("employee_reg_relatives", {
  id: serial("id").primaryKey(),
  registrationId: integer("registration_id").notNull(),
  relativeName: text("relative_name").notNull(),
  relationship: text("relationship"),
  contactNumber: text("contact_number"),
  country: text("country"),
  address: text("address"),
  documentFileData: text("document_file_data"),
  documentFileName: text("document_file_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type EmployeeRegistration = typeof employeeRegistrationsTable.$inferSelect;
export type EmployeeRegDocument = typeof employeeRegDocumentsTable.$inferSelect;
export type EmployeeRegExperience = typeof employeeRegExperienceTable.$inferSelect;
export type EmployeeRegEducation = typeof employeeRegEducationTable.$inferSelect;
export type EmployeeRegRelative = typeof employeeRegRelativesTable.$inferSelect;
