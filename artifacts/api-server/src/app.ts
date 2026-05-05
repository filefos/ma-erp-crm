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
    // Letterhead snapshot — back-fill columns for older rows
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS letterhead_brand TEXT`);
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS company_legal_name TEXT`);
    // Salesman commission module — additive, all nullable.
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS commission_enabled BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS commission_target_amount DOUBLE PRECISION`);
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS commission_currency TEXT DEFAULT 'AED'`);
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS commission_base_rate_pct DOUBLE PRECISION`);
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS commission_bonus_per_step_amount DOUBLE PRECISION`);
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS commission_bonus_step_size DOUBLE PRECISION`);
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS commission_shortfall_tier1_pct DOUBLE PRECISION`);
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS commission_shortfall_tier1_deduction_pct DOUBLE PRECISION`);
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS commission_shortfall_tier2_pct DOUBLE PRECISION`);
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS commission_shortfall_tier2_deduction_pct DOUBLE PRECISION`);
    await db.execute(sql`ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS commission_notes TEXT`);
    // Race-free letter number sequence — replaces fragile count(*)+1 numbering.
    // Initialize to max existing letter_number suffix so legacy rows don't
    // collide on the unique constraint.
    await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS offer_letter_number_seq START 1`);
    await db.execute(sql`SELECT setval('offer_letter_number_seq', GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(letter_number, '[^0-9]', '', 'g'), '')::bigint), 0) FROM offer_letters),
      1
    ), true)`);
    // Per-brand offer letter sequences so reference numbers carry the
    // company prefix (PMOL- for Prime Max, EOL- for Elite). Each sequence
    // is seeded from the highest existing numeric suffix on letters of
    // that brand, preventing collisions on the unique letter_number col.
    await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS offer_letter_number_seq_prime START 1`);
    await db.execute(sql`SELECT setval('offer_letter_number_seq_prime', GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(letter_number, '[^0-9]', '', 'g'), '')::bigint), 0)
         FROM offer_letters WHERE letter_number LIKE 'PMOL-%'),
      1
    ), true)`);
    await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS offer_letter_number_seq_elite START 1`);
    await db.execute(sql`SELECT setval('offer_letter_number_seq_elite', GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(letter_number, '[^0-9]', '', 'g'), '')::bigint), 0)
         FROM offer_letters WHERE letter_number LIKE 'EOL-%'),
      1
    ), true)`);
    // Race-free employee id sequence — replaces count(*)+1 in convert-to-employee.
    // Initialize to max existing EMP-##### so it doesn't collide with seeded rows.
    await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS employee_number_seq START 1`);
    await db.execute(sql`SELECT setval('employee_number_seq', GREATEST(
      (SELECT COALESCE(MAX(NULLIF(regexp_replace(employee_id, '[^0-9]', '', 'g'), '')::bigint), 0) FROM employees),
      1
    ), true)`);

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

    // Grant default permissions on the new "payroll" module. Read-only for
    // most roles; only admins / HR get full access. Idempotent.
    const payrollRoleGrants: Array<{ role: string; row: string }> = [
      { role: "super_admin",      row: "(SELECT id FROM roles WHERE code='super_admin'),      'payroll', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE" },
      { role: "company_admin",    row: "(SELECT id FROM roles WHERE code='company_admin'),    'payroll', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE" },
      { role: "department_admin", row: "(SELECT id FROM roles WHERE code='department_admin'), 'payroll', TRUE, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE" },
      { role: "manager",          row: "(SELECT id FROM roles WHERE code='manager'),          'payroll', TRUE, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE" },
      { role: "user",             row: "(SELECT id FROM roles WHERE code='user'),             'payroll', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE" },
      { role: "data_entry",       row: "(SELECT id FROM roles WHERE code='data_entry'),       'payroll', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE" },
      { role: "viewer",           row: "(SELECT id FROM roles WHERE code='viewer'),           'payroll', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE" },
    ];
    for (const g of payrollRoleGrants) {
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

    // Per-offer-letter attachments (academic / supporting documents).
    // Files live in object storage; the row stores only the object key.
    await db.execute(sql`CREATE TABLE IF NOT EXISTS offer_letter_attachments (
      id SERIAL PRIMARY KEY,
      offer_letter_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      object_key TEXT NOT NULL,
      content_type TEXT,
      size_bytes INTEGER,
      uploaded_by_id INTEGER,
      uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    // Migrate any earlier rows that used the inline base64 column.
    await db.execute(sql`ALTER TABLE offer_letter_attachments ADD COLUMN IF NOT EXISTS object_key TEXT`);
    await db.execute(sql`ALTER TABLE offer_letter_attachments DROP COLUMN IF EXISTS content_base64`);
    await db.execute(sql`ALTER TABLE offer_letter_attachments ALTER COLUMN object_key SET NOT NULL`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS offer_letter_attachments_offer_idx ON offer_letter_attachments(offer_letter_id)`);
    // Add FK constraint if not already present (idempotent via DO block)
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'offer_letter_attachments_offer_letter_id_fk'
            AND table_name = 'offer_letter_attachments'
        ) THEN
          ALTER TABLE offer_letter_attachments
            ADD CONSTRAINT offer_letter_attachments_offer_letter_id_fk
            FOREIGN KEY (offer_letter_id) REFERENCES offer_letters(id) ON DELETE CASCADE;
        END IF;
      END $$
    `);

    // Push notification device tokens (one row per Expo push token, per user/device).
    await db.execute(sql`CREATE TABLE IF NOT EXISTS device_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      platform TEXT,
      device_name TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS device_tokens_user_idx ON device_tokens(user_id)`);

    // Backfill created_by_id for legacy rows on per-user-private tables.
    // Pick the first super_admin (or any admin) as the synthetic owner so legacy
    // records remain visible to admins after privacy enforcement is active.
    const adminRow = await db.execute(sql`
      SELECT id FROM users
      WHERE permission_level IN ('super_admin','company_admin','department_admin')
      ORDER BY (permission_level='super_admin') DESC, id ASC
      LIMIT 1
    `);
    const adminId = (adminRow.rows?.[0] as { id?: number } | undefined)?.id;
    if (adminId) {
      for (const tbl of ["contacts","leads","quotations","lpos","proforma_invoices","tax_invoices","delivery_notes"]) {
        await db.execute(sql.raw(`UPDATE ${tbl} SET created_by_id = ${adminId} WHERE created_by_id IS NULL`));
      }
    }

    // User unique codes (USR-0001 format) ─ one-time setup + backfill
    await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS user_code_seq START 1`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS user_code TEXT`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS users_user_code_unique ON users(user_code) WHERE user_code IS NOT NULL`);
    // Backfill existing users ordered by id
    await db.execute(sql`
      UPDATE users u
      SET user_code = 'USR-' || LPAD(ranked.rn::text, 4, '0')
      FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY id ASC) AS rn
        FROM users WHERE user_code IS NULL
      ) ranked
      WHERE u.id = ranked.id
    `);
    // Sync the sequence so new users pick up where backfill left off
    await db.execute(sql`
      SELECT setval('user_code_seq',
        COALESCE(MAX(CAST(SUBSTRING(user_code FROM 5) AS INTEGER)), 0), true)
      FROM users WHERE user_code IS NOT NULL
    `);

    // ── User Activity Monitor ──────────────────────────────────────────────
    await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS unique_user_id_seq START 1`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS unique_user_id TEXT`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_activity_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        company_id INTEGER,
        unique_user_id TEXT,
        login_at TIMESTAMP NOT NULL DEFAULT NOW(),
        logout_at TIMESTAMP,
        last_heartbeat_at TIMESTAMP,
        active_seconds INTEGER NOT NULL DEFAULT 0,
        idle_seconds INTEGER NOT NULL DEFAULT 0,
        focus_lost_count INTEGER NOT NULL DEFAULT 0,
        session_key TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS user_activity_sessions_session_key_idx
        ON user_activity_sessions(session_key) WHERE session_key IS NOT NULL
    `);
    // Backfill unique_user_id for existing users that don't have one yet
    // Format: {companyPrefix}{moduleCode}-{YY}{MM}-{SEQ}
    await db.execute(sql`
      UPDATE users u
      SET unique_user_id = (
        SELECT
          UPPER(COALESCE(c.prefix,'PM')) ||
          CASE
            WHEN lower(u.role) LIKE '%account%' OR lower(u.role) LIKE '%financ%' THEN 'AC'
            WHEN lower(u.role) LIKE '%sale%'    THEN 'SA'
            WHEN lower(u.role) LIKE '%crm%'     THEN 'CR'
            WHEN lower(u.role) LIKE '%procure%' OR lower(u.role) LIKE '%purchas%' THEN 'PR'
            WHEN lower(u.role) LIKE '%inventor%' OR lower(u.role) LIKE '%warehouse%' THEN 'IN'
            WHEN lower(u.role) LIKE '%project%' THEN 'PJ'
            WHEN lower(u.role) LIKE '%hr%' OR lower(u.role) LIKE '%human%' THEN 'HR'
            WHEN lower(u.role) LIKE '%asset%'   THEN 'AS'
            ELSE 'AD'
          END || '-' ||
          TO_CHAR(NOW(), 'YY') || TO_CHAR(NOW(), 'MM') || '-' ||
          LPAD(nextval('unique_user_id_seq')::text, 4, '0')
        FROM companies c WHERE c.id = u.company_id
      )
      WHERE u.unique_user_id IS NULL
    `);

    logger.info("Schema migrations applied");
  } catch (err) {
    logger.warn({ err }, "Migration warning (non-fatal)");
  }
}

runMigrations();

const app: Express = express();

app.set("trust proxy", 1);

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
