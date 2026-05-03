import { db, rolesTable, permissionsTable, proformaInvoicesTable, deliveryNotesTable, companiesTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";

const MODULES = [
  "dashboard", "leads", "contacts", "deals", "activities",
  "quotations", "proforma_invoices", "lpos", "tax_invoices", "delivery_notes",
  "expenses", "cheques", "bank_accounts",
  "suppliers", "purchase_requests", "purchase_orders",
  "inventory_items", "stock_entries", "assets",
  "projects",
  "employees", "attendance",
  "users", "companies", "departments", "roles", "audit_logs",
  "emails", "whatsapp", "email_settings",
] as const;

type PermSet = { canView?: boolean; canCreate?: boolean; canEdit?: boolean; canApprove?: boolean; canDelete?: boolean; canExport?: boolean; canPrint?: boolean };

const full = (): PermSet => ({ canView: true, canCreate: true, canEdit: true, canApprove: true, canDelete: true, canExport: true, canPrint: true });
const manage = (): PermSet => ({ canView: true, canCreate: true, canEdit: true, canApprove: true, canDelete: false, canExport: true, canPrint: true });
const operate = (): PermSet => ({ canView: true, canCreate: true, canEdit: true, canApprove: false, canDelete: false, canExport: true, canPrint: true });
const dataEntry = (): PermSet => ({ canView: true, canCreate: true, canEdit: true, canApprove: false, canDelete: false, canExport: false, canPrint: true });
const viewOnly = (): PermSet => ({ canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true, canPrint: true });

async function main() {
  console.log("Fixing roles and permissions...");

  const roleData = [
    { code: "super_admin", name: "Super Admin", description: "Unrestricted access across all companies and modules", permissionLevel: 100, isSystem: true },
    { code: "company_admin", name: "Company Admin", description: "Full access within an assigned company", permissionLevel: 90, isSystem: true },
    { code: "department_admin", name: "Department Admin", description: "Full access to a single department's modules", permissionLevel: 80, isSystem: true },
    { code: "manager", name: "Manager", description: "Approves transactions and views all department data", permissionLevel: 70, isSystem: true },
    { code: "user", name: "User", description: "Standard staff user — create/edit own work", permissionLevel: 50, isSystem: true },
    { code: "data_entry", name: "Data Entry Operator", description: "Records transactions, no approval/delete/export", permissionLevel: 30, isSystem: true },
    { code: "viewer", name: "Viewer", description: "Read-only and printing/export of reports", permissionLevel: 10, isSystem: true },
  ];

  for (const r of roleData) {
    await db.insert(rolesTable).values(r).onConflictDoNothing();
  }

  const roles = await db.select().from(rolesTable);
  const roleByCode = (c: string) => roles.find(r => r.code === c)!;

  console.log(`Found ${roles.length} roles`);

  await db.delete(permissionsTable);

  const adminOnly = ["users", "companies", "departments", "roles", "audit_logs", "email_settings"];
  const permRows: Array<{ roleId: number; module: string } & PermSet> = [];

  for (const m of MODULES) {
    const isAdminOnly = adminOnly.includes(m);
    permRows.push({ roleId: roleByCode("super_admin").id, module: m, ...full() });
    permRows.push({ roleId: roleByCode("company_admin").id, module: m, ...full() });
    permRows.push({ roleId: roleByCode("department_admin").id, module: m, ...(isAdminOnly ? { canView: true, canExport: true, canPrint: true } : manage()) });
    permRows.push({ roleId: roleByCode("manager").id, module: m, ...(isAdminOnly ? { canView: true, canExport: true, canPrint: true } : manage()) });
    permRows.push({ roleId: roleByCode("user").id, module: m, ...(isAdminOnly ? {} : operate()) });
    permRows.push({ roleId: roleByCode("data_entry").id, module: m, ...(isAdminOnly ? {} : dataEntry()) });
    permRows.push({ roleId: roleByCode("viewer").id, module: m, ...(isAdminOnly ? { canView: true, canPrint: true } : viewOnly()) });
  }

  if (permRows.length > 0) {
    await db.insert(permissionsTable).values(permRows);
  }
  console.log(`✓ Inserted ${permRows.length} permission rows`);

  // Add items column if missing (safe migration)
  try {
    await db.execute(sql`ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS items TEXT DEFAULT '[]'`);
    console.log("✓ PI items column ensured");
  } catch {}

  try {
    await db.execute(sql`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS tech_specs TEXT`);
    console.log("✓ Quotation tech_specs column ensured");
  } catch {}

  // Seed PI if empty
  const piCount = await db.select({ count: sql<number>`count(*)::int` }).from(proformaInvoicesTable);
  if ((piCount[0]?.count ?? 0) === 0) {
    const companies = await db.select({ id: companiesTable.id, prefix: companiesTable.prefix }).from(companiesTable);
    const pm = companies.find(c => c.prefix === "PM");
    const ep = companies.find(c => c.prefix === "EP");
    if (pm) {
      await (db as any).execute(sql`
        INSERT INTO proforma_invoices (pi_number, company_id, client_name, project_name, subtotal, vat_amount, total, payment_terms, validity_date, status, items)
        VALUES ('PM-PI-2026-0001', ${pm.id}, 'Gulf Construction LLC', 'Sharjah Labour Accommodation',
          742857, 37143, 780000, '50% advance, 50% on delivery', '2026-06-30', 'approved',
          ${JSON.stringify([
            { description: "Prefabricated Labour Accommodation Unit - Type A (4-man room)", quantity: 50, unit: "nos", rate: 8000, amount: 400000 },
            { description: "Prefabricated Toilet & Bathroom Block", quantity: 10, unit: "nos", rate: 15000, amount: 150000 },
            { description: "Prefabricated Canteen / Dining Unit", quantity: 2, unit: "nos", rate: 35000, amount: 70000 },
            { description: "Site Security Cabin", quantity: 2, unit: "nos", rate: 5000, amount: 10000 },
            { description: "Transportation & Delivery charges", quantity: 1, unit: "lot", rate: 25000, amount: 25000 },
            { description: "Foundation & leveling works", quantity: 60, unit: "nos", rate: 1464.28, amount: 87857 },
          ])}
        )
      `);
    }
    if (ep) {
      await (db as any).execute(sql`
        INSERT INTO proforma_invoices (pi_number, company_id, client_name, project_name, subtotal, vat_amount, total, payment_terms, validity_date, status, items)
        VALUES ('EP-PI-2026-0001', ${ep.id}, 'Ajman Education Authority', 'Ajman Prefab School',
          833333, 41667, 875000, '75% advance, 25% on delivery', '2026-06-15', 'pending',
          ${JSON.stringify([
            { description: "Prefabricated Classroom Unit - 30 student capacity", quantity: 8, unit: "nos", rate: 75000, amount: 600000 },
            { description: "Prefabricated Teachers Room", quantity: 2, unit: "nos", rate: 40000, amount: 80000 },
            { description: "Prefabricated Administration Block", quantity: 1, unit: "nos", rate: 65000, amount: 65000 },
            { description: "Prefabricated Toilet Block Boys", quantity: 1, unit: "nos", rate: 45000, amount: 45000 },
            { description: "Prefabricated Toilet Block Girls", quantity: 1, unit: "nos", rate: 43333, amount: 43333 },
          ])}
        )
      `);
    }
    console.log("✓ Seeded proforma invoices with items");
  }

  // Seed DN if empty
  const dnCount = await db.select({ count: sql<number>`count(*)::int` }).from(deliveryNotesTable);
  if ((dnCount[0]?.count ?? 0) === 0) {
    const companies = await db.select({ id: companiesTable.id, prefix: companiesTable.prefix }).from(companiesTable);
    const pm = companies.find(c => c.prefix === "PM");
    const ep = companies.find(c => c.prefix === "EP");
    if (pm) {
      await db.insert(deliveryNotesTable).values({
        dnNumber: "PM-DN-2026-0001", companyId: pm.id,
        clientName: "Emirates Catering", projectName: "Fujairah Catering Units",
        deliveryDate: "2026-03-28", deliveryLocation: "Fujairah Industrial Site",
        vehicleNumber: "Dubai F 12345", driverName: "Mohammed Ali",
        receiverName: "James Brown", status: "delivered",
        items: JSON.stringify([
          { description: "Prefabricated Catering Unit Type A", quantity: 2, unit: "nos" },
          { description: "Prefabricated Catering Unit Type B", quantity: 1, unit: "nos" },
        ]),
      });
    }
    if (ep) {
      await db.insert(deliveryNotesTable).values({
        dnNumber: "EP-DN-2026-0001", companyId: ep.id,
        clientName: "Dubai World Corp", projectName: "EXPO Site Offices",
        deliveryDate: "2026-04-20", deliveryLocation: "Dubai Expo Site",
        vehicleNumber: "Dubai G 54321", driverName: "Ravi Kumar",
        receiverName: "Sarah Mitchell", status: "pending",
        items: JSON.stringify([
          { description: "Prefabricated Site Office Unit Standard", quantity: 5, unit: "nos" },
        ]),
      });
    }
    console.log("✓ Seeded delivery notes");
  }

  console.log("All done!");
}

main().catch(console.error).finally(() => process.exit(0));
