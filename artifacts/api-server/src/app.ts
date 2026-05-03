import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function runMigrations() {
  try {
    await db.execute(sql`ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS items TEXT DEFAULT '[]'`);
    await db.execute(sql`ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS client_email TEXT`);
    await db.execute(sql`ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS client_phone TEXT`);
    await db.execute(sql`ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS project_location TEXT`);
    await db.execute(sql`ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS vat_percent DOUBLE PRECISION DEFAULT 5`);
    await db.execute(sql`ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS notes TEXT`);
    await db.execute(sql`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS tech_specs TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_url TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS automation_level TEXT NOT NULL DEFAULT 'suggest'`);
    await db.execute(sql`ALTER TABLE lpos ADD COLUMN IF NOT EXISTS lpo_file_url TEXT`);
    await db.execute(sql`ALTER TABLE lpos ADD COLUMN IF NOT EXISTS scope TEXT`);
    // Supplier enhancements
    await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS company_id INTEGER`);
    await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS whatsapp TEXT`);
    await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS website TEXT`);
    await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_name TEXT`);
    await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_account_name TEXT`);
    await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_account_number TEXT`);
    await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS iban TEXT`);
    await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`);
    await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes TEXT`);
    // PR enhancements
    await db.execute(sql`ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS project_ref TEXT`);
    await db.execute(sql`ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS department TEXT`);
    await db.execute(sql`ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);
    // PO enhancements
    await db.execute(sql`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rfq_id INTEGER`);
    await db.execute(sql`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_quotation_id INTEGER`);
    await db.execute(sql`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_location TEXT`);
    await db.execute(sql`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS notes TEXT`);
    await db.execute(sql`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS prepared_by_id INTEGER`);
    await db.execute(sql`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);
    // Project enhancements: salesperson + delivery date
    await db.execute(sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS salesperson_id INTEGER`);
    await db.execute(sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS delivery_date TEXT`);
    // Sales-force GPS + selfie attendance enhancements
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS user_id INTEGER`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS company_id INTEGER`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS accuracy_meters DOUBLE PRECISION`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_latitude DOUBLE PRECISION`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_longitude DOUBLE PRECISION`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_accuracy_meters DOUBLE PRECISION`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS selfie_object_key TEXT`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_selfie_object_key TEXT`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS source TEXT`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS address TEXT`);
    // Sales targets table
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sales_targets (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly',
      year INTEGER NOT NULL,
      month INTEGER,
      quarter INTEGER,
      target_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    // New RFQ table
    await db.execute(sql`CREATE TABLE IF NOT EXISTS rfqs (
      id SERIAL PRIMARY KEY,
      rfq_number TEXT NOT NULL UNIQUE,
      company_id INTEGER NOT NULL,
      purchase_request_id INTEGER,
      status TEXT NOT NULL DEFAULT 'draft',
      required_delivery_date TEXT,
      payment_terms TEXT,
      notes TEXT,
      items TEXT DEFAULT '[]',
      supplier_ids TEXT DEFAULT '[]',
      created_by_id INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    // New Supplier Quotations table
    await db.execute(sql`CREATE TABLE IF NOT EXISTS supplier_quotations (
      id SERIAL PRIMARY KEY,
      sq_number TEXT NOT NULL UNIQUE,
      company_id INTEGER NOT NULL,
      rfq_id INTEGER,
      supplier_id INTEGER NOT NULL,
      supplier_quotation_ref TEXT,
      quotation_date TEXT,
      subtotal DOUBLE PRECISION DEFAULT 0,
      vat_amount DOUBLE PRECISION DEFAULT 0,
      total DOUBLE PRECISION DEFAULT 0,
      delivery_time TEXT,
      payment_terms TEXT,
      warranty TEXT,
      notes TEXT,
      attachment_url TEXT,
      status TEXT NOT NULL DEFAULT 'received',
      selection_reason TEXT,
      items TEXT DEFAULT '[]',
      created_by_id INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    // WhatsApp Business Cloud API integration
    await db.execute(sql`CREATE TABLE IF NOT EXISTS whatsapp_accounts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone_number_id TEXT NOT NULL UNIQUE,
      waba_id TEXT,
      display_phone TEXT,
      access_token_env TEXT NOT NULL DEFAULT 'WHATSAPP_ACCESS_TOKEN',
      company_id INTEGER,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS whatsapp_threads (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL,
      peer_wa_id TEXT NOT NULL,
      peer_name TEXT,
      lead_id INTEGER,
      deal_id INTEGER,
      contact_id INTEGER,
      project_id INTEGER,
      last_message_at TIMESTAMP,
      last_message_preview TEXT,
      last_direction TEXT,
      unread_count INTEGER NOT NULL DEFAULT 0,
      company_id INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_threads_account_peer_idx ON whatsapp_threads(account_id, peer_wa_id)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id SERIAL PRIMARY KEY,
      thread_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      direction TEXT NOT NULL,
      wa_message_id TEXT,
      from_wa TEXT,
      to_wa TEXT,
      message_type TEXT NOT NULL DEFAULT 'text',
      body TEXT,
      media_url TEXT,
      media_caption TEXT,
      template_name TEXT,
      template_language TEXT,
      template_vars TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      error_code DOUBLE PRECISION,
      error_text TEXT,
      sent_at TIMESTAMP,
      delivered_at TIMESTAMP,
      read_at TIMESTAMP,
      received_at TIMESTAMP,
      sent_by_id INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS whatsapp_messages_thread_idx ON whatsapp_messages(thread_id, created_at)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS whatsapp_messages_wamid_idx ON whatsapp_messages(wa_message_id)`);

    // Supplier self-registration portal
    await db.execute(sql`CREATE TABLE IF NOT EXISTS supplier_categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS supplier_registrations (
      id SERIAL PRIMARY KEY,
      ref_number TEXT NOT NULL UNIQUE,
      company_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_review',
      company_name TEXT NOT NULL,
      trade_license_no TEXT,
      license_expiry TEXT,
      established_year TEXT,
      company_size TEXT,
      country TEXT,
      city TEXT,
      address TEXT,
      website TEXT,
      contact_person TEXT NOT NULL,
      designation TEXT,
      email TEXT NOT NULL,
      phone TEXT,
      whatsapp TEXT,
      trn TEXT,
      vat_registered BOOLEAN NOT NULL DEFAULT FALSE,
      chamber_membership TEXT,
      bank_name TEXT,
      bank_account_name TEXT,
      bank_account_number TEXT,
      iban TEXT,
      swift TEXT,
      currency TEXT DEFAULT 'AED',
      categories TEXT DEFAULT '[]',
      payment_terms TEXT,
      delivery_terms TEXT,
      years_experience TEXT,
      major_clients TEXT,
      attachments TEXT DEFAULT '[]',
      agreed_terms BOOLEAN NOT NULL DEFAULT FALSE,
      submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ip_address TEXT,
      reviewed_by_id INTEGER,
      reviewed_at TIMESTAMP,
      review_notes TEXT,
      supplier_id_created INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS supplier_registrations_status_idx ON supplier_registrations(status, company_id)`);

    // Add columns introduced after initial release (idempotent).
    const supplierRegAdds: Array<[string, string]> = [
      ["trade_name", "TEXT"],
      ["license_authority", "TEXT"],
      ["emirate", "TEXT"],
      ["po_box", "TEXT"],
      ["tender_contact_name", "TEXT"],
      ["tender_contact_mobile", "TEXT"],
      ["tender_contact_email", "TEXT"],
      ["vat_certificate_expiry", "TEXT"],
      ["bank_branch", "TEXT"],
      ["categories_other", "TEXT"],
      ["turnover_band", "TEXT"],
      ["employee_band", "TEXT"],
      ["reference_clients", "TEXT DEFAULT '[]'"],
      ["agreed_code_of_conduct", "BOOLEAN NOT NULL DEFAULT FALSE"],
    ];
    for (const [col, def] of supplierRegAdds) {
      await db.execute(sql.raw(`ALTER TABLE supplier_registrations ADD COLUMN IF NOT EXISTS ${col} ${def}`));
    }
    // Approved-supplier code + expiry tracking columns.
    const supplierAdds: Array<[string, string]> = [
      ["code", "TEXT"],
      ["trade_license_expiry", "TEXT"],
      ["vat_certificate_expiry", "TEXT"],
      ["license_expiry_reminder_sent_at", "TIMESTAMP"],
      ["vat_expiry_reminder_sent_at", "TIMESTAMP"],
    ];
    for (const [col, def] of supplierAdds) {
      await db.execute(sql.raw(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS ${col} ${def}`));
    }
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS suppliers_code_company_idx ON suppliers(company_id, code) WHERE code IS NOT NULL`);

    // --- Task #43: Employee profile expansion + attachments + offer letters ---
    const employeeAdds: Array<[string, string]> = [
      ["photo_object_key", "TEXT"],
      ["passport_no", "TEXT"],
      ["passport_expiry", "TEXT"],
      ["emirates_id_no", "TEXT"],
      ["emirates_id_expiry", "TEXT"],
      ["date_of_birth", "TEXT"],
      ["gender", "TEXT"],
      ["marital_status", "TEXT"],
      ["home_address", "TEXT"],
      ["personal_email", "TEXT"],
      ["personal_phone", "TEXT"],
      ["emergency_contact_name", "TEXT"],
      ["emergency_contact_phone", "TEXT"],
      ["basic_salary", "DOUBLE PRECISION"],
      ["allowances", "DOUBLE PRECISION"],
    ];
    for (const [col, def] of employeeAdds) {
      await db.execute(sql.raw(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS ${col} ${def}`));
    }
    await db.execute(sql`CREATE TABLE IF NOT EXISTS employee_attachments (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      file_name TEXT NOT NULL,
      object_key TEXT NOT NULL,
      content_type TEXT,
      size_bytes INTEGER,
      notes TEXT,
      uploaded_by_id INTEGER,
      uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS employee_attachments_employee_idx ON employee_attachments(employee_id)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS offer_letters (
      id SERIAL PRIMARY KEY,
      letter_number TEXT NOT NULL UNIQUE,
      company_id INTEGER NOT NULL,
      template_type TEXT NOT NULL DEFAULT 'staff',
      status TEXT NOT NULL DEFAULT 'draft',
      employee_id INTEGER,
      candidate_name TEXT NOT NULL,
      candidate_nationality TEXT,
      candidate_passport_no TEXT,
      candidate_personal_email TEXT,
      candidate_personal_phone TEXT,
      designation TEXT,
      joining_date TEXT,
      basic_salary DOUBLE PRECISION,
      allowances DOUBLE PRECISION,
      worker_type TEXT,
      notes TEXT,
      issued_at TIMESTAMP,
      accepted_at TIMESTAMP,
      rejected_at TIMESTAMP,
      rejection_reason TEXT,
      parent_offer_id INTEGER,
      version INTEGER NOT NULL DEFAULT 1,
      converted_employee_id INTEGER,
      converted_at TIMESTAMP,
      created_by_id INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS offer_letters_company_status_idx ON offer_letters(company_id, status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS offer_letters_employee_idx ON offer_letters(employee_id)`);

    // Grant default permissions on the new "offer_letters" module to existing
    // roles so HR users see the module without needing a re-seed. Idempotent.
    const offerLetterRoleGrants: Array<{ role: string; row: string }> = [
      { role: "super_admin",      row: "(SELECT id FROM roles WHERE code='super_admin'),      'offer_letters', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE" },
      { role: "company_admin",    row: "(SELECT id FROM roles WHERE code='company_admin'),    'offer_letters', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE" },
      { role: "department_admin", row: "(SELECT id FROM roles WHERE code='department_admin'), 'offer_letters', TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE" },
      { role: "manager",          row: "(SELECT id FROM roles WHERE code='manager'),          'offer_letters', TRUE, TRUE, TRUE, FALSE, FALSE, TRUE, TRUE" },
      { role: "user",             row: "(SELECT id FROM roles WHERE code='user'),             'offer_letters', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE" },
      { role: "data_entry",       row: "(SELECT id FROM roles WHERE code='data_entry'),       'offer_letters', TRUE, TRUE, TRUE, FALSE, FALSE, FALSE, TRUE" },
      { role: "viewer",           row: "(SELECT id FROM roles WHERE code='viewer'),           'offer_letters', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE" },
    ];
    for (const g of offerLetterRoleGrants) {
      await db.execute(sql.raw(`
        INSERT INTO permissions (role_id, module, can_view, can_create, can_edit, can_approve, can_delete, can_export, can_print)
        SELECT ${g.row}
        WHERE EXISTS (SELECT 1 FROM roles WHERE code='${g.role}')
        ON CONFLICT (role_id, module) DO NOTHING
      `));
    }

    // Seed the 18 prefab-construction supplier categories (per task spec).
    // These replace any earlier seed list; ON CONFLICT (name) DO NOTHING keeps
    // re-runs idempotent. Existing applications referencing the old names by
    // string are unaffected (categories are stored as JSON strings, not FKs).
    const seedCategories = [
      "Sandwich Panels (PUF / EPS / Rockwool)",
      "Steel & Structural Steel",
      "Aluminium Profiles & Cladding",
      "Doors & Windows (uPVC / Aluminium)",
      "MEP — Electrical",
      "MEP — Plumbing & Sanitary",
      "HVAC / AC Units",
      "Insulation Materials",
      "Hardware Fasteners & Fixings",
      "Paints & Coatings",
      "Joinery & Carpentry",
      "Civil Works / Foundations",
      "Crane Hire & Heavy Equipment",
      "Transport & Logistics",
      "Manpower Supply",
      "Safety / PPE / HSE Supplies",
      "Stationery & IT Equipment",
      "Other",
    ];
    for (let i = 0; i < seedCategories.length; i++) {
      await db.execute(sql`
        INSERT INTO supplier_categories (name, sort_order, is_active)
        VALUES (${seedCategories[i]}, ${i}, TRUE)
        ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_active = TRUE
      `);
    }

    logger.info("Schema migrations applied");
  } catch (err) {
    logger.warn({ err }, "Migration warning (non-fatal)");
  }
}

runMigrations();

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Larger limits to support file uploads (base64-embedded attachments,
// quotation/LPO line item images, signatures, logos, etc.)
app.use(express.json({
  limit: "25mb",
  // Capture the raw body so the WhatsApp webhook can verify Meta's
  // X-Hub-Signature-256 HMAC against the exact bytes Meta sent.
  verify: (req, _res, buf) => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip ?? "");
    const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim() : "";
    return `${ip}:${email}`;
  },
  message: { error: "Too many login attempts. Please try again later." },
  skipSuccessfulRequests: true,
});

app.use("/api/auth/login", loginRateLimiter);
app.use("/api", router);

export default app;
