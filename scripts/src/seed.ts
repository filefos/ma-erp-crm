import { db } from "@workspace/db";
import {
  companiesTable, departmentsTable, usersTable, leadsTable, contactsTable, dealsTable,
  quotationsTable, quotationItemsTable,
  taxInvoicesTable, projectsTable, suppliersTable,
  purchaseRequestsTable, purchaseOrdersTable, inventoryItemsTable, stockEntriesTable,
  assetsTable, employeesTable, attendanceTable, bankAccountsTable, chequesTable,
  expensesTable, notificationsTable, auditLogsTable,
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
  console.log("Seeding database (Phase 1 secure foundation)...");

  // Wipe everything in dependency order
  await db.execute(sql`TRUNCATE TABLE
    notifications, audit_logs,
    user_permissions, user_company_access, permissions, roles,
    attendance, employees,
    cheques, bank_accounts, expenses,
    stock_entries, inventory_items,
    purchase_orders, purchase_requests, suppliers,
    assets, projects,
    quotation_items, quotations, proforma_invoices, tax_invoices, delivery_notes, lpos,
    activities, deals, contacts, leads,
    users, departments, companies
    RESTART IDENTITY CASCADE`);

  // ===== COMPANIES (2) =====
  const [pm, ep] = await db.insert(companiesTable).values([
    {
      name: "PRIME MAX PREFAB HOUSES IND. LLC.",
      shortName: "Prime Max",
      prefix: "PM",
      address: "Industrial Area 12, Sharjah, United Arab Emirates",
      phone: "+971-6-555-0100",
      email: "info@primemax-uae.com",
      website: "www.primemax-uae.com",
      trn: "100234567890001",
      vatPercent: 5,
      bankDetails: "Emirates NBD\nA/c Name: PRIME MAX PREFAB HOUSES IND. LLC.\nA/c No: 1234567890101\nIBAN: AE070331234567890101001\nSWIFT: EBILAEAD",
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
    { name: "Main Admin", description: "System administration and global oversight" },
    { name: "Sales", description: "CRM, leads, quotations, customer relations" },
    { name: "Accounts", description: "Tax invoices, receivables, customer payments" },
    { name: "Finance", description: "Cash flow, banking, accounting, reporting" },
    { name: "Procurement", description: "Suppliers, purchase requests and orders" },
    { name: "Store", description: "Stock receipts, issues, warehouse operations" },
    { name: "Inventory", description: "Inventory items, stock levels, valuation" },
    { name: "Assets", description: "Asset register, maintenance, depreciation" },
    { name: "HR", description: "Employees, attendance, payroll" },
    { name: "Production", description: "Manufacturing, production scheduling" },
    { name: "Management", description: "Executive oversight, reports, decision support" },
  ]).returning();

  const dept = (n: string) => depts.find(d => d.name === n)!;

  // ===== ROLES (7) =====
  const roles = await db.insert(rolesTable).values([
    { code: "super_admin", name: "Super Admin", description: "Unrestricted access across all companies and modules", permissionLevel: 100, isSystem: true },
    { code: "company_admin", name: "Company Admin", description: "Full access within an assigned company", permissionLevel: 90, isSystem: true },
    { code: "department_admin", name: "Department Admin", description: "Full access to a single department's modules", permissionLevel: 80, isSystem: true },
    { code: "manager", name: "Manager", description: "Approves transactions and views all department data", permissionLevel: 70, isSystem: true },
    { code: "user", name: "User", description: "Standard staff user — create/edit own work", permissionLevel: 50, isSystem: true },
    { code: "data_entry", name: "Data Entry Operator", description: "Records transactions, no approval/delete/export", permissionLevel: 30, isSystem: true },
    { code: "viewer", name: "Viewer", description: "Read-only and printing/export of reports", permissionLevel: 10, isSystem: true },
  ]).returning();
  const roleByCode = (c: string) => roles.find(r => r.code === c)!;

  // ===== PERMISSION MATRIX =====
  const permRows: Array<{ roleId: number; module: string } & PermSet> = [];
  for (const m of MODULES) {
    permRows.push({ roleId: roleByCode("super_admin").id, module: m, ...full() });
    permRows.push({ roleId: roleByCode("company_admin").id, module: m, ...full() });
    permRows.push({ roleId: roleByCode("department_admin").id, module: m, ...manage() });
    permRows.push({ roleId: roleByCode("manager").id, module: m, ...manage() });
    permRows.push({ roleId: roleByCode("user").id, module: m, ...operate() });
    permRows.push({ roleId: roleByCode("data_entry").id, module: m, ...dataEntry() });
    permRows.push({ roleId: roleByCode("viewer").id, module: m, ...viewOnly() });
  }
  // Lock down admin-only modules for non-admin roles
  const adminOnly = ["users", "companies", "departments", "roles", "audit_logs", "email_settings"];
  for (const r of permRows) {
    if (adminOnly.includes(r.module) && !["super_admin", "company_admin"].includes(roles.find(x => x.id === r.roleId)!.code)) {
      r.canCreate = false; r.canEdit = false; r.canDelete = false; r.canApprove = false;
      if (!["department_admin", "manager"].includes(roles.find(x => x.id === r.roleId)!.code)) {
        r.canView = false; r.canExport = false; r.canPrint = false;
      }
    }
  }
  await db.insert(permissionsTable).values(permRows);

  // ===== USERS (9) =====
  // role = department/role identifier; permissionLevel = 7-tier code
  const userSpecs = [
    { name: "Super Administrator", email: "admin@erp.com", password: "Admin@2026", phone: "+971-50-100-0001", role: "super_admin", department: "Main Admin", company: pm.id, permissionLevel: "super_admin", companies: [pm.id, ep.id] },
    { name: "Hassan Al Mansoori (PM Admin)", email: "manager@primemax.ae", password: "Manager@2026", phone: "+971-50-100-0002", role: "admin", department: "Management", company: pm.id, permissionLevel: "company_admin", companies: [pm.id] },
    { name: "Ahmad Al-Rashidi (Sales)", email: "sales@primemax.ae", password: "Sales@2026", phone: "+971-50-100-0003", role: "sales", department: "Sales", company: pm.id, permissionLevel: "user", companies: [pm.id] },
    { name: "Sara Hassan (Accounts)", email: "accounts@primemax.ae", password: "Accounts@2026", phone: "+971-50-100-0004", role: "accounts", department: "Accounts", company: pm.id, permissionLevel: "manager", companies: [pm.id] },
    { name: "Fatima Al-Zaabi (Finance)", email: "finance@eliteprefab.ae", password: "Finance@2026", phone: "+971-50-100-0005", role: "finance", department: "Finance", company: ep.id, permissionLevel: "manager", companies: [ep.id] },
    { name: "Ravi Kumar (Procurement)", email: "procurement@primemax.ae", password: "Proc@2026", phone: "+971-50-100-0006", role: "procurement", department: "Procurement", company: pm.id, permissionLevel: "user", companies: [pm.id, ep.id] },
    { name: "Priya Nair (Store)", email: "store@primemax.ae", password: "Store@2026", phone: "+971-50-100-0007", role: "store", department: "Store", company: pm.id, permissionLevel: "data_entry", companies: [pm.id] },
    { name: "Hassan Ali (HR)", email: "hr@primemax.ae", password: "Hr@2026", phone: "+971-50-100-0008", role: "hr", department: "HR", company: pm.id, permissionLevel: "department_admin", companies: [pm.id, ep.id] },
    { name: "Mohammed Khalid (Production)", email: "production@eliteprefab.ae", password: "Prod@2026", phone: "+971-50-100-0009", role: "production", department: "Production", company: ep.id, permissionLevel: "user", companies: [ep.id] },
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

  // user_company_access
  const access: Array<{ userId: number; companyId: number; isPrimary: boolean }> = [];
  for (let i = 0; i < userSpecs.length; i++) {
    const u = users[i];
    const spec = userSpecs[i];
    for (const cid of spec.companies) {
      access.push({ userId: u.id, companyId: cid, isPrimary: cid === spec.company });
    }
  }
  await db.insert(userCompanyAccessTable).values(access);

  console.log(`✓ Created ${users.length} users with company access`);

  // ===== DEMO BUSINESS DATA (preserve existing seed for other modules) =====
  const userByEmail = (e: string) => users.find(u => u.email === e)!;

  // Leads
  await db.insert(leadsTable).values([
    { leadNumber: "LEAD-2026-0001", leadName: "Al Barari Villas Project", companyName: "Al Barari Developments", contactPerson: "Omar Al-Sayed", phone: "+971-55-123-4567", whatsapp: "+971-55-123-4567", email: "omar@albarari.ae", location: "Dubai", source: "referral", requirementType: "Villa Prefab", quantity: 20, budget: 1500000, status: "qualified", leadScore: "hot", companyId: pm.id, assignedToId: userByEmail("sales@primemax.ae").id, notes: "Client wants 20 prefab villas, budget confirmed" },
    { leadNumber: "LEAD-2026-0002", leadName: "Sharjah Labour Camp", companyName: "Gulf Construction LLC", contactPerson: "Vijay Menon", phone: "+971-50-234-5678", whatsapp: "+971-50-234-5678", email: "vijay@gulfcon.ae", location: "Sharjah", source: "website", requirementType: "Labour Accommodation", quantity: 100, budget: 800000, status: "quotation_sent", leadScore: "warm", companyId: pm.id, assignedToId: userByEmail("sales@primemax.ae").id },
    { leadNumber: "LEAD-2026-0003", leadName: "EXPO Site Office Prefabs", companyName: "Dubai World Corp", contactPerson: "Sarah Mitchell", phone: "+971-55-345-6789", email: "sarah@dubaiworldcorp.ae", location: "Dubai", source: "exhibition", requirementType: "Site Office", quantity: 5, budget: 250000, status: "new", leadScore: "warm", companyId: ep.id },
    { leadNumber: "LEAD-2026-0004", leadName: "Abu Dhabi Storage Units", companyName: "AD Logistics", contactPerson: "Khalid Bin Said", phone: "+971-50-456-7890", whatsapp: "+971-50-456-7890", location: "Abu Dhabi", source: "cold_call", requirementType: "Storage Containers", quantity: 30, budget: 400000, status: "contacted", leadScore: "cold", companyId: ep.id },
    { leadNumber: "LEAD-2026-0005", leadName: "Ras Al Khaimah Farm Houses", companyName: "RAK Properties", contactPerson: "Abdullah Jasim", phone: "+971-55-567-8901", whatsapp: "+971-55-567-8901", email: "ajasim@rakprop.ae", location: "Ras Al Khaimah", source: "referral", requirementType: "Farm Houses", quantity: 8, budget: 600000, status: "negotiation", leadScore: "hot", companyId: pm.id, assignedToId: userByEmail("sales@primemax.ae").id },
    { leadNumber: "LEAD-2026-0006", leadName: "Ajman School Prefab", companyName: "Ajman Education Authority", contactPerson: "Dr. Hind Al-Mansoori", phone: "+971-50-678-9012", email: "hind@ajmanedu.ae", location: "Ajman", source: "government_tender", requirementType: "Prefab Classrooms", quantity: 10, budget: 900000, status: "site_visit", leadScore: "hot", companyId: ep.id },
    { leadNumber: "LEAD-2026-0007", leadName: "Fujairah Catering Units", companyName: "Emirates Catering", contactPerson: "James Brown", phone: "+971-55-789-0123", location: "Fujairah", source: "exhibition", requirementType: "Catering Units", quantity: 3, budget: 120000, status: "won", leadScore: "hot", companyId: pm.id },
    { leadNumber: "LEAD-2026-0008", leadName: "Dubai Marina Modular Retail", companyName: "Emaar Retail", contactPerson: "Lisa Chen", phone: "+971-50-890-1234", email: "lisachen@emaar.ae", location: "Dubai Marina", source: "referral", requirementType: "Modular Retail Shops", quantity: 15, budget: 750000, status: "lost", leadScore: "cold", companyId: ep.id },
  ]);

  await db.insert(contactsTable).values([
    { name: "Omar Al-Sayed", email: "omar@albarari.ae", phone: "+971-55-123-4567", whatsapp: "+971-55-123-4567", companyName: "Al Barari Developments", designation: "Procurement Manager", companyId: pm.id },
    { name: "Vijay Menon", email: "vijay@gulfcon.ae", phone: "+971-50-234-5678", companyName: "Gulf Construction LLC", designation: "Director", companyId: pm.id },
    { name: "Sarah Mitchell", email: "sarah@dubaiworldcorp.ae", phone: "+971-55-345-6789", companyName: "Dubai World Corp", designation: "Project Manager", companyId: ep.id },
  ]);

  const allLeads = await db.select().from(leadsTable);
  await db.insert(dealsTable).values([
    { dealNumber: "DEAL-2026-0001", title: "Al Barari 20 Villas Deal", clientName: "Al Barari Developments", value: 1450000, stage: "proposal", probability: 70, expectedCloseDate: "2026-06-30", companyId: pm.id, leadId: allLeads.find(l => l.leadName === "Al Barari Villas Project")?.id, assignedToId: userByEmail("sales@primemax.ae").id },
    { dealNumber: "DEAL-2026-0002", title: "Sharjah Labour Camp 100 Units", clientName: "Gulf Construction LLC", value: 780000, stage: "negotiation", probability: 85, expectedCloseDate: "2026-05-15", companyId: pm.id, assignedToId: userByEmail("sales@primemax.ae").id },
    { dealNumber: "DEAL-2026-0003", title: "Fujairah Catering Units", clientName: "Emirates Catering", value: 115000, stage: "won", probability: 100, expectedCloseDate: "2026-04-01", companyId: pm.id },
  ]);

  // Quotations
  const [q1] = await db.insert(quotationsTable).values({
    quotationNumber: "PM-QTN-2026-0001",
    companyId: pm.id,
    clientName: "Gulf Construction LLC",
    clientEmail: "vijay@gulfcon.ae",
    clientPhone: "+971-50-234-5678",
    projectName: "Sharjah Labour Accommodation",
    projectLocation: "Industrial Area, Sharjah",
    status: "sent",
    subtotal: 742857,
    discount: 0,
    vatPercent: 5,
    vatAmount: 37143,
    grandTotal: 780000,
    paymentTerms: "50% advance, 40% on delivery, 10% on completion",
    validity: "30 days",
    termsConditions: "All prices are inclusive of delivery to site. Installation not included.",
    preparedById: userByEmail("sales@primemax.ae").id,
  }).returning();

  await db.insert(quotationItemsTable).values([
    { quotationId: q1.id, description: "Prefabricated Labour Accommodation Unit - Type A (4-man room)", quantity: 50, unit: "nos", rate: 8000, amount: 400000, sortOrder: 1 },
    { quotationId: q1.id, description: "Prefabricated Toilet & Bathroom Block", quantity: 10, unit: "nos", rate: 15000, amount: 150000, sortOrder: 2 },
    { quotationId: q1.id, description: "Prefabricated Canteen / Dining Unit", quantity: 2, unit: "nos", rate: 35000, amount: 70000, sortOrder: 3 },
    { quotationId: q1.id, description: "Site Security Cabin", quantity: 2, unit: "nos", rate: 5000, amount: 10000, sortOrder: 4 },
    { quotationId: q1.id, description: "Transportation & Delivery charges", quantity: 1, unit: "lot", rate: 25000, amount: 25000, sortOrder: 5 },
    { quotationId: q1.id, description: "Foundation & leveling works (per unit)", quantity: 60, unit: "nos", rate: 1464.28, amount: 87857, sortOrder: 6 },
  ]);

  // Tax invoices
  await db.insert(taxInvoicesTable).values([
    { invoiceNumber: "PM-INV-2026-0001", companyId: pm.id, companyTrn: "100234567890001", clientName: "Emirates Catering", invoiceDate: "2026-04-01", supplyDate: "2026-03-28", subtotal: 109524, vatPercent: 5, vatAmount: 5476, grandTotal: 115000, amountPaid: 115000, balance: 0, paymentStatus: "paid" },
    { invoiceNumber: "PM-INV-2026-0002", companyId: pm.id, companyTrn: "100234567890001", clientName: "Gulf Construction LLC", invoiceDate: "2026-04-15", supplyDate: "2026-04-10", subtotal: 380952, vatPercent: 5, vatAmount: 19048, grandTotal: 400000, amountPaid: 200000, balance: 200000, paymentStatus: "partial" },
    { invoiceNumber: "EP-INV-2026-0001", companyId: ep.id, companyTrn: "100456789012002", clientName: "Dubai World Corp", invoiceDate: "2026-04-20", supplyDate: "2026-04-18", subtotal: 238095, vatPercent: 5, vatAmount: 11905, grandTotal: 250000, amountPaid: 0, balance: 250000, paymentStatus: "unpaid" },
  ]);

  await db.insert(projectsTable).values([
    { projectNumber: "PM-PRJ-2026-0001", projectName: "Emirates Catering Fujairah", clientName: "Emirates Catering", companyId: pm.id, location: "Fujairah", scope: "3 catering units supply and install", projectValue: 115000, stage: "completed", productionStatus: "done", procurementStatus: "done", deliveryStatus: "done", installationStatus: "done", paymentStatus: "paid", startDate: "2026-02-01", endDate: "2026-03-28" },
    { projectNumber: "PM-PRJ-2026-0002", projectName: "Gulf Con Labour Camp Sharjah", clientName: "Gulf Construction LLC", companyId: pm.id, location: "Sharjah Industrial Area", scope: "100 accommodation units, 10 toilet blocks", projectValue: 780000, stage: "production", productionStatus: "in_progress", procurementStatus: "done", deliveryStatus: "pending", installationStatus: "pending", paymentStatus: "partial", startDate: "2026-03-15" },
  ]);

  await db.insert(suppliersTable).values([
    { name: "Emirates Steel Structures LLC", contactPerson: "Tariq Farouk", email: "tariq@emiratessteel.ae", phone: "+971-6-555-1001", address: "Industrial Area 15, Sharjah", category: "Steel & Structure", paymentTerms: "30 days credit" },
    { name: "Gulf Insulation Materials", contactPerson: "Suresh Pillai", phone: "+971-50-321-4567", email: "suresh@gulfinsulation.ae", address: "Ajman Industrial", category: "Insulation & Panels", paymentTerms: "COD" },
  ]);

  const suppliers = await db.select().from(suppliersTable);
  const allProjects = await db.select().from(projectsTable);
  await db.insert(purchaseRequestsTable).values([
    { prNumber: "PM-PR-2026-0001", companyId: pm.id, projectId: allProjects[1]?.id, description: "Steel sections for 100 accommodation units", priority: "high", status: "approved", requestedById: userByEmail("procurement@primemax.ae").id, requiredDate: "2026-04-15", items: JSON.stringify([{ description: "MS Steel I-Beam 200x100mm", quantity: 500, unit: "kg" }]) },
    { prNumber: "PM-PR-2026-0002", companyId: pm.id, description: "Electrical fittings and wiring", priority: "normal", status: "pending", requestedById: userByEmail("procurement@primemax.ae").id, requiredDate: "2026-05-01", items: JSON.stringify([{ description: "Electrical Cable 6mm2", quantity: 1000, unit: "mtrs" }]) },
  ]);

  await db.insert(purchaseOrdersTable).values([
    { poNumber: "PM-PO-2026-0001", supplierId: suppliers[0].id, companyId: pm.id, subtotal: 95238, vatAmount: 4762, total: 100000, status: "confirmed", paymentTerms: "30 days", deliveryDate: "2026-04-15", items: JSON.stringify([{ description: "MS Steel I-Beam 200x100mm", quantity: 500, unit: "kg", rate: 190.47 }]) },
  ]);

  const [item1, , , item4] = await db.insert(inventoryItemsTable).values([
    { itemCode: "ITEM-00001", name: "MS Steel I-Beam 200x100mm", category: "Steel & Structure", unit: "kg", currentStock: 2500, openingStock: 3000, minimumStock: 500, unitCost: 2.5, warehouseLocation: "Rack A1", companyId: pm.id },
    { itemCode: "ITEM-00002", name: "Rockwool Insulation Panel 100mm", category: "Insulation", unit: "sqm", currentStock: 800, openingStock: 1000, minimumStock: 200, unitCost: 35, warehouseLocation: "Rack B2", companyId: pm.id },
    { itemCode: "ITEM-00003", name: "PVC Windows 1.2x1.2m", category: "Windows & Doors", unit: "nos", currentStock: 45, openingStock: 50, minimumStock: 10, unitCost: 350, warehouseLocation: "Rack C1", companyId: pm.id },
    { itemCode: "ITEM-00004", name: "Steel Door Frame 900x2100mm", category: "Windows & Doors", unit: "nos", currentStock: 8, openingStock: 20, minimumStock: 10, unitCost: 180, warehouseLocation: "Rack C2", companyId: pm.id },
  ]).returning();

  await db.insert(stockEntriesTable).values([
    { entryNumber: "SE-2026-00001", type: "stock_in", itemId: item1.id, quantity: 500, unit: "kg", reference: "PM-PO-2026-0001", notes: "Received from Emirates Steel", approvalStatus: "approved", createdById: userByEmail("store@primemax.ae").id, companyId: pm.id },
    { entryNumber: "SE-2026-00002", type: "stock_out", itemId: item4.id, quantity: 5, unit: "nos", reference: "PM-PRJ-2026-0002", notes: "Issued for Labour Camp project - Block A", approvalStatus: "approved", createdById: userByEmail("store@primemax.ae").id, companyId: pm.id },
  ]);

  await db.insert(assetsTable).values([
    { assetId: "PM-ASSET-0001", name: "Hiab Crane Truck - 5 Ton", category: "Vehicles & Equipment", purchaseDate: "2023-06-01", purchaseValue: 180000, currentLocation: "Sharjah Yard", condition: "good", status: "active", companyId: pm.id, maintenanceDate: "2026-06-01" },
    { assetId: "PM-ASSET-0002", name: "Forklift - 3 Ton Diesel", category: "Vehicles & Equipment", purchaseDate: "2022-01-15", purchaseValue: 95000, currentLocation: "Sharjah Warehouse", condition: "good", status: "active", companyId: pm.id, maintenanceDate: "2026-03-15" },
    { assetId: "EP-ASSET-0001", name: "Pickup Truck Ford Ranger 2024", category: "Vehicles & Equipment", purchaseDate: "2024-01-01", purchaseValue: 120000, currentLocation: "Dubai Office", condition: "excellent", status: "active", companyId: ep.id, maintenanceDate: "2026-07-01" },
  ]);

  const employees = await db.insert(employeesTable).values([
    { employeeId: "EMP-00001", name: "Ahmad Al-Rashidi", type: "staff", designation: "Sales Manager", departmentId: dept("Sales").id, companyId: pm.id, phone: "+971-50-100-0003", email: "sales@primemax.ae", nationality: "UAE", joiningDate: "2022-01-01" },
    { employeeId: "EMP-00002", name: "Ravi Kumar", type: "staff", designation: "Procurement Officer", departmentId: dept("Procurement").id, companyId: pm.id, phone: "+971-50-100-0006", nationality: "India", joiningDate: "2021-06-15" },
    { employeeId: "EMP-00003", name: "Ramesh Kumar", type: "labor", designation: "Steel Fabricator", companyId: pm.id, phone: "+971-52-111-2233", nationality: "India", siteLocation: "Sharjah Factory", joiningDate: "2022-08-01" },
  ]).returning();

  const today = new Date().toISOString().split("T")[0];
  await db.insert(attendanceTable).values([
    { employeeId: employees[0].id, date: today, checkIn: "08:05", checkOut: "17:30", status: "present", latitude: 25.3287, longitude: 55.4382 },
    { employeeId: employees[1].id, date: today, checkIn: "08:00", checkOut: "17:00", status: "present" },
    { employeeId: employees[2].id, date: today, checkIn: "07:45", checkOut: "17:45", overtime: 0.75, status: "present" },
  ]);

  const [bank1] = await db.insert(bankAccountsTable).values([
    { bankName: "Emirates NBD", accountName: "PRIME MAX PREFAB HOUSES IND. LLC.", accountNumber: "1234567890101", iban: "AE070331234567890101001", swiftCode: "EBILAEAD", currency: "AED", companyId: pm.id },
    { bankName: "Mashreq Bank", accountName: "Elite Pre-Fabricated Houses Trading Co. LLC", accountNumber: "5555666677778", iban: "AE200330005555666677778", swiftCode: "BOMLAEAD", currency: "AED", companyId: ep.id },
  ]).returning();

  await db.insert(chequesTable).values([
    { chequeNumber: "000001", bankAccountId: bank1.id, payeeName: "Emirates Steel Structures LLC", amount: 100000, amountInWords: "One Hundred Thousand UAE Dirhams Only", chequeDate: "2026-05-01", status: "approved", supplierId: suppliers[0].id, companyId: pm.id, preparedById: userByEmail("accounts@primemax.ae").id },
  ]);

  await db.insert(expensesTable).values([
    { expenseNumber: "EXP-2026-00001", category: "office", amount: 2500, vatAmount: 125, total: 2625, paymentMethod: "bank_transfer", paymentDate: "2026-04-05", status: "approved", companyId: pm.id, description: "Office rent - April 2026", createdById: userByEmail("accounts@primemax.ae").id },
  ]);

  // Audit logs (foundation)
  const sa = userByEmail("admin@erp.com");
  const cm = userByEmail("manager@primemax.ae");
  await db.insert(auditLogsTable).values([
    { userId: sa.id, userName: sa.name, action: "login", entity: "auth", details: "Main admin signed in", ipAddress: "127.0.0.1" },
    { userId: sa.id, userName: sa.name, action: "create", entity: "company", entityId: pm.id, details: "Created company PRIME MAX PREFAB HOUSES IND. LLC." },
    { userId: sa.id, userName: sa.name, action: "create", entity: "company", entityId: ep.id, details: "Created company Elite Pre-Fabricated Houses Trading Co. LLC" },
    { userId: sa.id, userName: sa.name, action: "create", entity: "user", entityId: cm.id, details: `Created user ${cm.email} with role company_admin` },
    { userId: sa.id, userName: sa.name, action: "permission_change", entity: "role", entityId: roleByCode("user").id, details: "Initialized default permission matrix for all 7 roles" },
    { userId: cm.id, userName: cm.name, action: "login", entity: "auth", details: "Company admin signed in" },
  ]);

  await db.insert(notificationsTable).values([
    { title: "Welcome to ERP CRM", message: "Phase 1 secure foundation is live. Configure additional companies, users, and roles in the Admin Panel.", type: "info", isRead: false, userId: sa.id },
    { title: "Quotation Pending Approval", message: "Quotation PM-QTN-2026-0001 for Gulf Construction LLC is awaiting your approval", type: "warning", isRead: false, userId: sa.id, entityType: "quotation", entityId: q1.id },
  ]);

  console.log("\n✓ Seed complete\n");
  console.log("=".repeat(60));
  console.log("TEST CREDENTIALS (Phase 1)");
  console.log("=".repeat(60));
  for (const u of userSpecs) {
    console.log(`  ${u.email.padEnd(30)} ${u.password.padEnd(14)}  [${u.permissionLevel}]`);
  }
  console.log("=".repeat(60));
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
