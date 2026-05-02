import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
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
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.use("/api", router);

export default app;
