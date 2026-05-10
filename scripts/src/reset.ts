import { db } from "@workspace/db";
import {
  companiesTable, departmentsTable, usersTable,
  rolesTable, permissionsTable, userCompanyAccessTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const MODULES = [
  "dashboard", "leads", "contacts", "deals", "activities",
  "quotations", "proforma_invoices", "lpos", "tax_invoices", "delivery_notes",
  "expenses", "cheques", "bank_accounts",
  "suppliers", "purchase_requests", "purchase_orders",
  "inventory_items", "stock_entries", "assets",
  "projects",
  "employees", "attendance", "offer_letters",
  "users", "companies", "departments", "roles", "audit_logs",
  "emails", "whatsapp", "email_settings",
] as const;

async function reset() {
  console.log("Wiping all data...");

  await db.execute(sql`TRUNCATE TABLE
    notifications, audit_logs, device_tokens,
    user_permissions, user_company_access, permissions, roles,
    user_activity_sessions, client_code_seqs,
    employee_reg_relatives, employee_reg_education, employee_reg_experience, employee_reg_documents, employee_registrations,
    offer_letter_attachments, offer_letters,
    employee_attachments, attendance, employees,
    payments_made, payments_received,
    journal_entry_lines, journal_entries, chart_of_accounts,
    cheques, bank_accounts, expenses,
    stock_entries, inventory_items,
    supplier_quotations, supplier_registrations, supplier_categories,
    rfqs, purchase_orders, purchase_requests, suppliers,
    assets, projects,
    handover_notes, undertaking_letters,
    quotation_items, quotations, proforma_invoices, tax_invoices, delivery_notes, lpos,
    contacts, leads,
    sales_targets,
    messages, conversations,
    emails, email_settings,
    users, departments, companies
    RESTART IDENTITY CASCADE`);

  console.log("All tables cleared.");

  // ── Company 1: Prime Max (id=1) ────────────────────────────────────────────
  const [primeMax] = await db.insert(companiesTable).values({
    name: "Prime Max Prefab Houses Ind. LLC",
    shortName: "Prime Max",
    prefix: "PM",
    trn: "105383255400003",
    vatPercent: 5,
    bankDetails: [
      "Account Title: PRIME MAX PREFAB HOUSES IND LLC SP",
      "IBAN: AE300030014498851920002",
      "Account Number: 14498851920002",
      "BIC / SWIFT: ADCBAEAAXXX",
      "Bank: ABU DHABI COMMERCIAL BANK",
    ].join("\n"),
  }).returning();
  console.log(`Created company: ${primeMax.name} (id=${primeMax.id})`);

  // ── Company 2: Elite (id=2) ────────────────────────────────────────────────
  const [elite] = await db.insert(companiesTable).values({
    name: "Elite Pre-Fabricated Houses Trading Co. LLC",
    shortName: "Elite",
    prefix: "EL",
    trn: "104200550200003",
    vatPercent: 5,
    bankDetails: [
      "Account Title: E L I T E PRE FABRICATED HOUSES TRA",
      "IBAN: AE320030013438011920001",
      "Account Number: 13438011920001",
      "BIC / SWIFT: ADCBAEAAXXX",
      "Bank: ABU DHABI COMMERCIAL BANK",
    ].join("\n"),
  }).returning();
  console.log(`Created company: ${elite.name} (id=${elite.id})`);

  // ── Departments ────────────────────────────────────────────────────────────
  const [pmDept] = await db.insert(departmentsTable).values({
    name: "Administration",
    companyId: primeMax.id,
  }).returning();

  await db.insert(departmentsTable).values({
    name: "Administration",
    companyId: elite.id,
  });

  // ── Super Admin role ───────────────────────────────────────────────────────
  const [superAdminRole] = await db.insert(rolesTable).values({
    code: "super_admin",
    name: "Super Admin",
    description: "Unrestricted access across all companies and modules",
    permissionLevel: 100,
    isSystem: true,
  }).returning();

  const permValues = MODULES.map(module => ({
    roleId: superAdminRole.id,
    module,
    canView: true, canCreate: true, canEdit: true,
    canApprove: true, canDelete: true, canExport: true, canPrint: true,
  }));
  await db.insert(permissionsTable).values(permValues);

  // ── Super Admin user ───────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Prime@2026", 10);

  const [admin] = await db.insert(usersTable).values({
    name: "Admin",
    email: "filefos@gmail.com",
    passwordHash,
    phone: "",
    roleId: superAdminRole.id,
    departmentId: pmDept.id,
    companyId: primeMax.id,
    permissionLevel: "super_admin",
    isActive: true,
  }).returning();

  // Grant access to both companies
  await db.insert(userCompanyAccessTable).values([
    { userId: admin.id, companyId: primeMax.id, isPrimary: true },
    { userId: admin.id, companyId: elite.id, isPrimary: false },
  ]);

  console.log("\n✓ Reset complete!");
  console.log("──────────────────────────────────────────────────────────────");
  console.log(`  Company 1: Prime Max Prefab Houses Ind. LLC  (TRN: 105383255400003)`);
  console.log(`  Company 2: Elite Pre-Fabricated Houses Trading Co. LLC  (TRN: 104200550200003)`);
  console.log(`  Login:     filefos@gmail.com  /  Prime@2026`);
  console.log("──────────────────────────────────────────────────────────────");
  process.exit(0);
}

reset().catch(err => {
  console.error("Reset failed:", err);
  process.exit(1);
});
