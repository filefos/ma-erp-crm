import { db } from "@workspace/db";
import {
  companiesTable, departmentsTable, usersTable,
  bankAccountsTable, notificationsTable,
  rolesTable, permissionsTable, userCompanyAccessTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

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

type PermSet = { canView?: boolean; canCreate?: boolean; canEdit?: boolean; canApprove?: boolean; canDelete?: boolean; canExport?: boolean; canPrint?: boolean };

function full(): PermSet {
  return { canView: true, canCreate: true, canEdit: true, canApprove: true, canDelete: true, canExport: true, canPrint: true };
}
function manage(): PermSet {
  return { canView: true, canCreate: true, canEdit: true, canApprove: true, canDelete: false, canExport: true, canPrint: true };
}
function operate(): PermSet {
  return { canView: true, canCreate: true, canEdit: true, canApprove: false, canDelete: false, canExport: true, canPrint: true };
}
function dataEntry(): PermSet {
  return { canView: true, canCreate: true, canEdit: true, canApprove: false, canDelete: false, canExport: false, canPrint: true };
}
function viewOnly(): PermSet {
  return { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true, canPrint: true };
}

async function seed() {
  console.log("Factory reset: wiping all data...");

  // Wipe every table — RESTART IDENTITY resets all auto-increment sequences
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

  console.log("✓ All data wiped");

  // ===== COMPANIES (2) =====
  const [pm, ep] = await db.insert(companiesTable).values([
    {
      name: "PRIME MAX PREFAB HOUSES IND. LLC. SP.",
      shortName: "Prime Max",
      prefix: "PM",
      address: "Industrial Area 12, Sharjah, United Arab Emirates",
      phone: "+971-6-555-0100",
      email: "info@primemax-uae.com",
      website: "www.primemax-uae.com",
      trn: "100234567890001",
      vatPercent: 5,
      bankDetails: "Emirates NBD\nA/c Name: PRIME MAX PREFAB HOUSES IND. LLC. SP.\nA/c No: 1234567890101\nIBAN: AE070331234567890101001\nSWIFT: EBILAEAD",
      logo: "/uploads/logos/prime-max.png",
    },
    {
      name: "Elite Pre-Fabricated Houses Trading Co. LLC",
      shortName: "Elite Prefab",
      prefix: "EP",
      address: "Dubai Investment Park 2, Dubai, United Arab Emirates",
      phone: "+971-4-555-0200",
      email: "info@eliteprefab-uae.com",
      website: "www.eliteprefab-uae.com",
      trn: "100456789012002",
      vatPercent: 5,
      bankDetails: "Mashreq Bank\nA/c Name: Elite Pre-Fabricated Houses Trading Co. LLC\nA/c No: 5555666677778\nIBAN: AE200330005555666677778\nSWIFT: BOMLAEAD",
      logo: "/uploads/logos/elite-prefab.png",
    },
  ]).returning();

  // ===== DEPARTMENTS (11) =====
  const depts = await db.insert(departmentsTable).values([
    { name: "Main Admin",  description: "System administration and global oversight" },
    { name: "Sales",       description: "CRM, leads, quotations, customer relations" },
    { name: "Accounts",    description: "Tax invoices, receivables, customer payments" },
    { name: "Finance",     description: "Cash flow, banking, accounting, reporting" },
    { name: "Procurement", description: "Suppliers, purchase requests and orders" },
    { name: "Store",       description: "Stock receipts, issues, warehouse operations" },
    { name: "Inventory",   description: "Inventory items, stock levels, valuation" },
    { name: "Assets",      description: "Asset register, maintenance, depreciation" },
    { name: "HR",          description: "Employees, attendance, payroll" },
    { name: "Production",  description: "Manufacturing, production scheduling" },
    { name: "Management",  description: "Executive oversight, reports, decision support" },
  ]).returning();

  const dept = (n: string) => depts.find(d => d.name === n)!;

  // ===== ROLES (7) =====
  const roles = await db.insert(rolesTable).values([
    { code: "super_admin",     name: "Super Admin",            description: "Unrestricted access across all companies and modules", permissionLevel: 100, isSystem: true },
    { code: "company_admin",   name: "Company Admin",          description: "Full access within an assigned company",               permissionLevel: 90,  isSystem: true },
    { code: "department_admin",name: "Department Admin",       description: "Full access to a single department's modules",         permissionLevel: 80,  isSystem: true },
    { code: "manager",         name: "Manager",                description: "Approves transactions and views all department data",  permissionLevel: 70,  isSystem: true },
    { code: "user",            name: "User",                   description: "Standard staff user — create/edit own work",          permissionLevel: 50,  isSystem: true },
    { code: "data_entry",      name: "Data Entry Operator",    description: "Records transactions, no approval/delete/export",     permissionLevel: 30,  isSystem: true },
    { code: "viewer",          name: "Viewer",                 description: "Read-only and printing/export of reports",            permissionLevel: 10,  isSystem: true },
  ]).returning();
  const roleByCode = (c: string) => roles.find(r => r.code === c)!;

  // ===== PERMISSION MATRIX =====
  const permRows: Array<{ roleId: number; module: string } & PermSet> = [];
  for (const m of MODULES) {
    permRows.push({ roleId: roleByCode("super_admin").id,      module: m, ...full() });
    permRows.push({ roleId: roleByCode("company_admin").id,    module: m, ...full() });
    permRows.push({ roleId: roleByCode("department_admin").id, module: m, ...manage() });
    permRows.push({ roleId: roleByCode("manager").id,          module: m, ...manage() });
    permRows.push({ roleId: roleByCode("user").id,             module: m, ...operate() });
    permRows.push({ roleId: roleByCode("data_entry").id,       module: m, ...dataEntry() });
    permRows.push({ roleId: roleByCode("viewer").id,           module: m, ...viewOnly() });
  }
  // Lock down admin-only modules for non-admin roles
  const adminOnly = ["users", "companies", "departments", "roles", "audit_logs", "email_settings"];
  for (const r of permRows) {
    const roleCode = roles.find(x => x.id === r.roleId)!.code;
    if (adminOnly.includes(r.module) && !["super_admin", "company_admin"].includes(roleCode)) {
      r.canCreate = false; r.canEdit = false; r.canDelete = false; r.canApprove = false;
      if (!["department_admin", "manager"].includes(roleCode)) {
        r.canView = false; r.canExport = false; r.canPrint = false;
      }
    }
  }
  await db.insert(permissionsTable).values(permRows);

  // ===== USERS (9 default accounts) =====
  const userSpecs = [
    { name: "Super Administrator",          email: "admin@erp.com",             password: "Admin@2026",   phone: "+971-50-100-0001", role: "super_admin",   department: "Main Admin",  company: pm.id, permissionLevel: "super_admin",     companies: [pm.id, ep.id] },
    { name: "Hassan Al Mansoori (PM Admin)",email: "manager@primemax.ae",       password: "Manager@2026", phone: "+971-50-100-0002", role: "admin",         department: "Management",  company: pm.id, permissionLevel: "company_admin",   companies: [pm.id] },
    { name: "Ahmad Al-Rashidi (Sales)",     email: "sales@primemax.ae",         password: "Sales@2026",   phone: "+971-50-100-0003", role: "sales",         department: "Sales",       company: pm.id, permissionLevel: "user",            companies: [pm.id] },
    { name: "Sara Hassan (Accounts)",       email: "accounts@primemax.ae",      password: "Accounts@2026",phone: "+971-50-100-0004", role: "accounts",      department: "Accounts",    company: pm.id, permissionLevel: "manager",         companies: [pm.id] },
    { name: "Fatima Al-Zaabi (Finance)",    email: "finance@eliteprefab.ae",    password: "Finance@2026", phone: "+971-50-100-0005", role: "finance",       department: "Finance",     company: ep.id, permissionLevel: "manager",         companies: [ep.id] },
    { name: "Ravi Kumar (Procurement)",     email: "procurement@primemax.ae",   password: "Proc@2026",    phone: "+971-50-100-0006", role: "procurement",   department: "Procurement", company: pm.id, permissionLevel: "user",            companies: [pm.id, ep.id] },
    { name: "Priya Nair (Store)",           email: "store@primemax.ae",         password: "Store@2026",   phone: "+971-50-100-0007", role: "store",         department: "Store",       company: pm.id, permissionLevel: "data_entry",      companies: [pm.id] },
    { name: "Hassan Ali (HR)",              email: "hr@primemax.ae",            password: "Hr@2026",      phone: "+971-50-100-0008", role: "hr",            department: "HR",          company: pm.id, permissionLevel: "department_admin", companies: [pm.id, ep.id] },
    { name: "Mohammed Khalid (Production)", email: "production@eliteprefab.ae", password: "Prod@2026",    phone: "+971-50-100-0009", role: "production",    department: "Production",  company: ep.id, permissionLevel: "user",            companies: [ep.id] },
  ] as const;

  const userValues = await Promise.all(userSpecs.map(async (u) => ({
    name: u.name,
    email: u.email,
    passwordHash: await hashPassword(u.password),
    phone: u.phone,
    role: u.role,
    departmentId: dept(u.department).id,
    companyId: u.company,
    permissionLevel: u.permissionLevel,
    status: "active",
    isActive: true,
  })));
  const users = await db.insert(usersTable).values(userValues).returning();

  const access: Array<{ userId: number; companyId: number; isPrimary: boolean }> = [];
  for (let i = 0; i < userSpecs.length; i++) {
    for (const cid of userSpecs[i].companies) {
      access.push({ userId: users[i].id, companyId: cid, isPrimary: cid === userSpecs[i].company });
    }
  }
  await db.insert(userCompanyAccessTable).values(access);

  // ===== BANK ACCOUNTS (company configuration — not transactional) =====
  await db.insert(bankAccountsTable).values([
    { bankName: "Emirates NBD",  accountName: "PRIME MAX PREFAB HOUSES IND. LLC.",          accountNumber: "1234567890101", iban: "AE070331234567890101001", swiftCode: "EBILAEAD", currency: "AED", companyId: pm.id },
    { bankName: "Mashreq Bank",  accountName: "Elite Pre-Fabricated Houses Trading Co. LLC", accountNumber: "5555666677778", iban: "AE200330005555666677778", swiftCode: "BOMLAEAD", currency: "AED", companyId: ep.id },
  ]);

  // ===== WELCOME NOTIFICATION =====
  const sa = users.find(u => u.email === "admin@erp.com")!;
  await db.insert(notificationsTable).values([
    { title: "System Reset Complete", message: "Factory reset successful. All modules are empty and ready for fresh data entry.", type: "info", isRead: false, userId: sa.id },
  ]);

  console.log("\n✓ Factory reset complete — clean system ready\n");
  console.log("=".repeat(60));
  console.log("LOGIN CREDENTIALS");
  console.log("=".repeat(60));
  for (const u of userSpecs) {
    console.log(`  ${u.email.padEnd(32)} ${u.password.padEnd(14)}  [${u.permissionLevel}]`);
  }
  console.log("=".repeat(60));
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
