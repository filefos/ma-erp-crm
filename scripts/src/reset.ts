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

  const [company] = await db.insert(companiesTable).values({
    name: "My Company",
    shortName: "MC",
    prefix: "MC",
  }).returning();

  console.log(`Created placeholder company: ${company.name} (id=${company.id})`);

  const [dept] = await db.insert(departmentsTable).values({
    name: "Administration",
    companyId: company.id,
  }).returning();

  const superAdminRole = await db.insert(rolesTable).values({
    code: "super_admin",
    name: "Super Admin",
    description: "Unrestricted access across all companies and modules",
    permissionLevel: 100,
    isSystem: true,
  }).returning();

  const permValues = MODULES.map(module => ({
    roleId: superAdminRole[0].id,
    module,
    canView: true, canCreate: true, canEdit: true,
    canApprove: true, canDelete: true, canExport: true, canPrint: true,
  }));
  await db.insert(permissionsTable).values(permValues);

  const passwordHash = await bcrypt.hash("Prime@2026", 10);

  const [admin] = await db.insert(usersTable).values({
    name: "Admin",
    email: "filefos@gmail.com",
    passwordHash,
    phone: "",
    roleId: superAdminRole[0].id,
    departmentId: dept.id,
    companyId: company.id,
    permissionLevel: "super_admin",
    isActive: true,
  }).returning();

  await db.insert(userCompanyAccessTable).values({
    userId: admin.id,
    companyId: company.id,
    isPrimary: true,
  });

  console.log("\n✓ Reset complete!");
  console.log("─────────────────────────────────────");
  console.log(`  Email:    filefos@gmail.com`);
  console.log(`  Password: Prime@2026`);
  console.log("─────────────────────────────────────");
  console.log("\nLog in and go to Admin → Companies to set up your real company.");
  process.exit(0);
}

reset().catch(err => {
  console.error("Reset failed:", err);
  process.exit(1);
});
