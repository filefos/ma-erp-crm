import { db } from "@workspace/db";
import {
  companiesTable, departmentsTable, usersTable, leadsTable, contactsTable, dealsTable,
  activitiesTable, quotationsTable, quotationItemsTable, proformaInvoicesTable,
  taxInvoicesTable, deliveryNotesTable, lposTable, projectsTable, suppliersTable,
  purchaseRequestsTable, purchaseOrdersTable, inventoryItemsTable, stockEntriesTable,
  assetsTable, employeesTable, attendanceTable, bankAccountsTable, chequesTable,
  expensesTable, notificationsTable, auditLogsTable
} from "@workspace/db";
import { createHmac } from "crypto";

function hashPassword(password: string): string {
  const salt = "erp_salt_2026";
  return createHmac("sha256", salt).update(password).digest("hex");
}

async function seed() {
  console.log("Seeding database...");

  // Companies
  const [pm, ep] = await db.insert(companiesTable).values([
    {
      name: "Prime Max Prefab Houses Industry LLC",
      shortName: "Prime Max",
      prefix: "PM",
      address: "Industrial Area 12, Sharjah, UAE",
      phone: "+971-6-555-0100",
      email: "info@primemax-uae.com",
      website: "www.primemax-uae.com",
      trn: "100234567890001",
      vatPercent: 5,
    },
    {
      name: "Elite Pre-Fabricated Houses Trading Co. LLC",
      shortName: "Elite Prefab",
      prefix: "EP",
      address: "Dubai Investment Park, Dubai, UAE",
      phone: "+971-4-555-0200",
      email: "info@eliteprefab-uae.com",
      website: "www.eliteprefab-uae.com",
      trn: "100456789012002",
      vatPercent: 5,
    },
  ]).returning();

  // Departments
  const depts = await db.insert(departmentsTable).values([
    { name: "Sales & CRM" },
    { name: "Accounts & Finance" },
    { name: "Procurement" },
    { name: "Production" },
    { name: "Store & Inventory" },
    { name: "Human Resources" },
    { name: "Administration" },
    { name: "Projects" },
  ]).returning();

  const salesDept = depts[0];
  const accountsDept = depts[1];
  const procDept = depts[2];
  const hrDept = depts[5];

  // Users
  await db.insert(usersTable).values([
    { name: "Super Admin", email: "admin@erp.com", passwordHash: hashPassword("Admin@2026"), phone: "+971-50-100-0001", role: "super_admin", companyId: pm.id, departmentId: depts[6].id, permissionLevel: "super_admin" },
    { name: "Ahmad Al-Rashidi", email: "ahmad@primemax.ae", passwordHash: hashPassword("Sales@2026"), phone: "+971-50-100-0002", role: "sales", companyId: pm.id, departmentId: salesDept.id },
    { name: "Sara Hassan", email: "sara@primemax.ae", passwordHash: hashPassword("Accounts@2026"), phone: "+971-50-100-0003", role: "accounts", companyId: pm.id, departmentId: accountsDept.id },
    { name: "Mohammed Khalid", email: "mohammed@eliteprefab.ae", passwordHash: hashPassword("Sales@2026"), phone: "+971-50-100-0004", role: "sales", companyId: ep.id, departmentId: salesDept.id },
    { name: "Fatima Al-Zaabi", email: "fatima@eliteprefab.ae", passwordHash: hashPassword("Finance@2026"), phone: "+971-50-100-0005", role: "finance", companyId: ep.id, departmentId: accountsDept.id },
    { name: "Ravi Kumar", email: "ravi@primemax.ae", passwordHash: hashPassword("Proc@2026"), phone: "+971-50-100-0006", role: "procurement", companyId: pm.id, departmentId: procDept.id },
    { name: "Ali Abdullah", email: "ali@erp.com", passwordHash: hashPassword("Admin@2026"), phone: "+971-50-100-0007", role: "admin", companyId: pm.id, departmentId: depts[6].id },
    { name: "Priya Nair", email: "priya@primemax.ae", passwordHash: hashPassword("Store@2026"), phone: "+971-50-100-0008", role: "store", companyId: pm.id, departmentId: depts[4].id },
    { name: "Hassan Ali", email: "hassan@primemax.ae", passwordHash: hashPassword("Hr@2026"), phone: "+971-50-100-0009", role: "hr", companyId: pm.id, departmentId: hrDept.id },
    { name: "Rohit Sharma", email: "rohit@eliteprefab.ae", passwordHash: hashPassword("Sales@2026"), phone: "+971-50-100-0010", role: "sales", companyId: ep.id, departmentId: salesDept.id },
  ]);

  const [users] = [await db.select().from(usersTable)];

  // Leads
  await db.insert(leadsTable).values([
    { leadNumber: "LEAD-2026-0001", leadName: "Al Barari Villas Project", companyName: "Al Barari Developments", contactPerson: "Omar Al-Sayed", phone: "+971-55-123-4567", whatsapp: "+971-55-123-4567", email: "omar@albarari.ae", location: "Dubai", source: "referral", requirementType: "Villa Prefab", quantity: 20, budget: 1500000, status: "qualified", leadScore: "hot", companyId: pm.id, assignedToId: users.find(u => u.email === "ahmad@primemax.ae")?.id, notes: "Client wants 20 prefab villas, budget confirmed" },
    { leadNumber: "LEAD-2026-0002", leadName: "Sharjah Labour Camp", companyName: "Gulf Construction LLC", contactPerson: "Vijay Menon", phone: "+971-50-234-5678", whatsapp: "+971-50-234-5678", email: "vijay@gulfcon.ae", location: "Sharjah", source: "website", requirementType: "Labour Accommodation", quantity: 100, budget: 800000, status: "quotation_sent", leadScore: "warm", companyId: pm.id, assignedToId: users.find(u => u.email === "ahmad@primemax.ae")?.id },
    { leadNumber: "LEAD-2026-0003", leadName: "EXPO Site Office Prefabs", companyName: "Dubai World Corp", contactPerson: "Sarah Mitchell", phone: "+971-55-345-6789", email: "sarah@dubaiworldcorp.ae", location: "Dubai", source: "exhibition", requirementType: "Site Office", quantity: 5, budget: 250000, status: "new", leadScore: "warm", companyId: ep.id, assignedToId: users.find(u => u.email === "mohammed@eliteprefab.ae")?.id },
    { leadNumber: "LEAD-2026-0004", leadName: "Abu Dhabi Storage Units", companyName: "AD Logistics", contactPerson: "Khalid Bin Said", phone: "+971-50-456-7890", whatsapp: "+971-50-456-7890", location: "Abu Dhabi", source: "cold_call", requirementType: "Storage Containers", quantity: 30, budget: 400000, status: "contacted", leadScore: "cold", companyId: ep.id, assignedToId: users.find(u => u.email === "rohit@eliteprefab.ae")?.id },
    { leadNumber: "LEAD-2026-0005", leadName: "Ras Al Khaimah Farm Houses", companyName: "RAK Properties", contactPerson: "Abdullah Jasim", phone: "+971-55-567-8901", whatsapp: "+971-55-567-8901", email: "ajasim@rakprop.ae", location: "Ras Al Khaimah", source: "referral", requirementType: "Farm Houses", quantity: 8, budget: 600000, status: "negotiation", leadScore: "hot", companyId: pm.id, assignedToId: users.find(u => u.email === "ahmad@primemax.ae")?.id },
    { leadNumber: "LEAD-2026-0006", leadName: "Ajman School Prefab", companyName: "Ajman Education Authority", contactPerson: "Dr. Hind Al-Mansoori", phone: "+971-50-678-9012", email: "hind@ajmanedu.ae", location: "Ajman", source: "government_tender", requirementType: "Prefab Classrooms", quantity: 10, budget: 900000, status: "site_visit", leadScore: "hot", companyId: ep.id, assignedToId: users.find(u => u.email === "mohammed@eliteprefab.ae")?.id },
    { leadNumber: "LEAD-2026-0007", leadName: "Fujairah Catering Units", companyName: "Emirates Catering", contactPerson: "James Brown", phone: "+971-55-789-0123", location: "Fujairah", source: "exhibition", requirementType: "Catering Units", quantity: 3, budget: 120000, status: "won", leadScore: "hot", companyId: pm.id },
    { leadNumber: "LEAD-2026-0008", leadName: "Dubai Marina Modular Retail", companyName: "Emaar Retail", contactPerson: "Lisa Chen", phone: "+971-50-890-1234", email: "lisachen@emaar.ae", location: "Dubai Marina", source: "referral", requirementType: "Modular Retail Shops", quantity: 15, budget: 750000, status: "lost", leadScore: "cold", companyId: ep.id },
  ]);

  // Contacts
  await db.insert(contactsTable).values([
    { name: "Omar Al-Sayed", email: "omar@albarari.ae", phone: "+971-55-123-4567", whatsapp: "+971-55-123-4567", companyName: "Al Barari Developments", designation: "Procurement Manager", companyId: pm.id },
    { name: "Vijay Menon", email: "vijay@gulfcon.ae", phone: "+971-50-234-5678", companyName: "Gulf Construction LLC", designation: "Director", companyId: pm.id },
    { name: "Sarah Mitchell", email: "sarah@dubaiworldcorp.ae", phone: "+971-55-345-6789", companyName: "Dubai World Corp", designation: "Project Manager", companyId: ep.id },
    { name: "Abdullah Jasim", email: "ajasim@rakprop.ae", phone: "+971-55-567-8901", companyName: "RAK Properties", designation: "CEO", companyId: pm.id },
  ]);

  // Deals
  const allLeads = await db.select().from(leadsTable);
  await db.insert(dealsTable).values([
    { dealNumber: "DEAL-2026-0001", title: "Al Barari 20 Villas Deal", clientName: "Al Barari Developments", value: 1450000, stage: "proposal", probability: 70, expectedCloseDate: "2026-06-30", companyId: pm.id, leadId: allLeads.find(l => l.leadName === "Al Barari Villas Project")?.id, assignedToId: users.find(u => u.email === "ahmad@primemax.ae")?.id },
    { dealNumber: "DEAL-2026-0002", title: "Sharjah Labour Camp 100 Units", clientName: "Gulf Construction LLC", value: 780000, stage: "negotiation", probability: 85, expectedCloseDate: "2026-05-15", companyId: pm.id, assignedToId: users.find(u => u.email === "ahmad@primemax.ae")?.id },
    { dealNumber: "DEAL-2026-0003", title: "Fujairah Catering Units", clientName: "Emirates Catering", value: 115000, stage: "won", probability: 100, expectedCloseDate: "2026-04-01", companyId: pm.id },
    { dealNumber: "DEAL-2026-0004", title: "Ajman School Prefab Classrooms", clientName: "Ajman Education Authority", value: 875000, stage: "qualification", probability: 60, expectedCloseDate: "2026-07-31", companyId: ep.id, assignedToId: users.find(u => u.email === "mohammed@eliteprefab.ae")?.id },
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
    preparedById: users.find(u => u.email === "ahmad@primemax.ae")?.id,
  }).returning();

  await db.insert(quotationItemsTable).values([
    { quotationId: q1.id, description: "Prefabricated Labour Accommodation Unit - Type A (4-man room)", quantity: 50, unit: "nos", rate: 8000, amount: 400000, sortOrder: 1 },
    { quotationId: q1.id, description: "Prefabricated Toilet & Bathroom Block", quantity: 10, unit: "nos", rate: 15000, amount: 150000, sortOrder: 2 },
    { quotationId: q1.id, description: "Prefabricated Canteen / Dining Unit", quantity: 2, unit: "nos", rate: 35000, amount: 70000, sortOrder: 3 },
    { quotationId: q1.id, description: "Site Security Cabin", quantity: 2, unit: "nos", rate: 5000, amount: 10000, sortOrder: 4 },
    { quotationId: q1.id, description: "Transportation & Delivery charges", quantity: 1, unit: "lot", rate: 25000, amount: 25000, sortOrder: 5 },
    { quotationId: q1.id, description: "Foundation & leveling works (per unit)", quantity: 60, unit: "nos", rate: 1464.28, amount: 87857, sortOrder: 6 },
  ]);

  const [q2] = await db.insert(quotationsTable).values({
    quotationNumber: "EP-QTN-2026-0001",
    companyId: ep.id,
    clientName: "Ajman Education Authority",
    clientEmail: "hind@ajmanedu.ae",
    projectName: "Ajman Prefab School",
    projectLocation: "Ajman",
    status: "draft",
    subtotal: 833333,
    discount: 0,
    vatPercent: 5,
    vatAmount: 41667,
    grandTotal: 875000,
    paymentTerms: "Government payment schedule",
    validity: "60 days",
    preparedById: users.find(u => u.email === "mohammed@eliteprefab.ae")?.id,
  }).returning();

  await db.insert(quotationItemsTable).values([
    { quotationId: q2.id, description: "Prefabricated Classroom Unit (8m x 6m)", quantity: 8, unit: "nos", rate: 45000, amount: 360000, sortOrder: 1 },
    { quotationId: q2.id, description: "Prefabricated Admin Block (10m x 8m)", quantity: 1, unit: "nos", rate: 75000, amount: 75000, sortOrder: 2 },
    { quotationId: q2.id, description: "Prefabricated Toilet Block (Boys & Girls)", quantity: 2, unit: "nos", rate: 35000, amount: 70000, sortOrder: 3 },
    { quotationId: q2.id, description: "Electrical & Plumbing works", quantity: 1, unit: "lot", rate: 150000, amount: 150000, sortOrder: 4 },
    { quotationId: q2.id, description: "Foundation & Site works", quantity: 1, unit: "lot", rate: 120000, amount: 120000, sortOrder: 5 },
    { quotationId: q2.id, description: "Transportation", quantity: 1, unit: "lot", rate: 58333, amount: 58333, sortOrder: 6 },
  ]);

  // Tax Invoices
  await db.insert(taxInvoicesTable).values([
    { invoiceNumber: "PM-INV-2026-0001", companyId: pm.id, companyTrn: "100234567890001", clientName: "Emirates Catering", invoiceDate: "2026-04-01", supplyDate: "2026-03-28", subtotal: 109524, vatPercent: 5, vatAmount: 5476, grandTotal: 115000, amountPaid: 115000, balance: 0, paymentStatus: "paid" },
    { invoiceNumber: "PM-INV-2026-0002", companyId: pm.id, companyTrn: "100234567890001", clientName: "Gulf Construction LLC", invoiceDate: "2026-04-15", supplyDate: "2026-04-10", subtotal: 380952, vatPercent: 5, vatAmount: 19048, grandTotal: 400000, amountPaid: 200000, balance: 200000, paymentStatus: "partial" },
    { invoiceNumber: "EP-INV-2026-0001", companyId: ep.id, companyTrn: "100456789012002", clientName: "Dubai World Corp", invoiceDate: "2026-04-20", supplyDate: "2026-04-18", subtotal: 238095, vatPercent: 5, vatAmount: 11905, grandTotal: 250000, amountPaid: 0, balance: 250000, paymentStatus: "unpaid" },
  ]);

  // Projects
  await db.insert(projectsTable).values([
    { projectNumber: "PM-PRJ-2026-0001", projectName: "Emirates Catering Fujairah", clientName: "Emirates Catering", companyId: pm.id, location: "Fujairah", scope: "3 catering units supply and install", projectValue: 115000, stage: "completed", productionStatus: "done", procurementStatus: "done", deliveryStatus: "done", installationStatus: "done", paymentStatus: "paid", startDate: "2026-02-01", endDate: "2026-03-28" },
    { projectNumber: "PM-PRJ-2026-0002", projectName: "Gulf Con Labour Camp Sharjah", clientName: "Gulf Construction LLC", companyId: pm.id, location: "Sharjah Industrial Area", scope: "100 accommodation units, 10 toilet blocks", projectValue: 780000, stage: "production", productionStatus: "in_progress", procurementStatus: "done", deliveryStatus: "pending", installationStatus: "pending", paymentStatus: "partial", startDate: "2026-03-15" },
    { projectNumber: "EP-PRJ-2026-0001", projectName: "Dubai World Corp Site Offices", clientName: "Dubai World Corp", companyId: ep.id, location: "Dubai Expo City", scope: "5 site office prefabs", projectValue: 250000, stage: "procurement", productionStatus: "pending", procurementStatus: "in_progress", deliveryStatus: "pending", installationStatus: "pending", paymentStatus: "unpaid", startDate: "2026-04-01" },
  ]);

  // Suppliers
  await db.insert(suppliersTable).values([
    { name: "Emirates Steel Structures LLC", contactPerson: "Tariq Farouk", email: "tariq@emiratessteel.ae", phone: "+971-6-555-1001", address: "Industrial Area 15, Sharjah", category: "Steel & Structure", paymentTerms: "30 days credit" },
    { name: "Gulf Insulation Materials", contactPerson: "Suresh Pillai", phone: "+971-50-321-4567", email: "suresh@gulfinsulation.ae", address: "Ajman Industrial", category: "Insulation & Panels", paymentTerms: "COD" },
    { name: "Dubai Electrical Suppliers", contactPerson: "Ibrahim Qasim", phone: "+971-4-555-2001", email: "ibrahim@dubaielec.ae", address: "Deira, Dubai", category: "Electrical", paymentTerms: "15 days credit" },
    { name: "Al-Futtaim Hardware", contactPerson: "Peter Davis", phone: "+971-4-555-3001", email: "pdavis@alfuttaim.ae", address: "Dubai Investment Park", category: "Hardware & Fixtures", paymentTerms: "30 days credit" },
    { name: "Sharjah Plumbing Supplies", contactPerson: "Raj Mohan", phone: "+971-6-555-4001", address: "Sharjah", category: "Plumbing", paymentTerms: "COD" },
  ]);

  const suppliers = await db.select().from(suppliersTable);

  // Purchase Requests
  const allProjects = await db.select().from(projectsTable);
  await db.insert(purchaseRequestsTable).values([
    { prNumber: "PM-PR-2026-0001", companyId: pm.id, projectId: allProjects[1]?.id, description: "Steel sections for 100 accommodation units", priority: "high", status: "approved", requestedById: users.find(u => u.email === "ravi@primemax.ae")?.id, requiredDate: "2026-04-15", items: JSON.stringify([{ description: "MS Steel I-Beam 200x100mm", quantity: 500, unit: "kg" }, { description: "MS Steel C-Channel 150x65mm", quantity: 300, unit: "kg" }]) },
    { prNumber: "PM-PR-2026-0002", companyId: pm.id, description: "Electrical fittings and wiring", priority: "normal", status: "pending", requestedById: users.find(u => u.email === "ravi@primemax.ae")?.id, requiredDate: "2026-05-01", items: JSON.stringify([{ description: "Electrical Cable 6mm2", quantity: 1000, unit: "mtrs" }, { description: "Circuit Breakers 20A", quantity: 50, unit: "nos" }]) },
  ]);

  await db.insert(purchaseOrdersTable).values([
    { poNumber: "PM-PO-2026-0001", supplierId: suppliers[0].id, companyId: pm.id, subtotal: 95238, vatAmount: 4762, total: 100000, status: "confirmed", paymentTerms: "30 days", deliveryDate: "2026-04-15", items: JSON.stringify([{ description: "MS Steel I-Beam 200x100mm", quantity: 500, unit: "kg", rate: 190.47 }]) },
  ]);

  // Inventory Items
  const [item1, item2, item3, item4, item5] = await db.insert(inventoryItemsTable).values([
    { itemCode: "ITEM-00001", name: "MS Steel I-Beam 200x100mm", category: "Steel & Structure", unit: "kg", currentStock: 2500, openingStock: 3000, minimumStock: 500, unitCost: 2.5, warehouseLocation: "Rack A1", companyId: pm.id },
    { itemCode: "ITEM-00002", name: "Rockwool Insulation Panel 100mm", category: "Insulation", unit: "sqm", currentStock: 800, openingStock: 1000, minimumStock: 200, unitCost: 35, warehouseLocation: "Rack B2", companyId: pm.id },
    { itemCode: "ITEM-00003", name: "PVC Windows 1.2x1.2m", category: "Windows & Doors", unit: "nos", currentStock: 45, openingStock: 50, minimumStock: 10, unitCost: 350, warehouseLocation: "Rack C1", companyId: pm.id },
    { itemCode: "ITEM-00004", name: "Steel Door Frame 900x2100mm", category: "Windows & Doors", unit: "nos", currentStock: 8, openingStock: 20, minimumStock: 10, unitCost: 180, warehouseLocation: "Rack C2", companyId: pm.id },
    { itemCode: "ITEM-00005", name: "Electrical Cable 6mm2 (per 100m roll)", category: "Electrical", unit: "rolls", currentStock: 15, openingStock: 20, minimumStock: 5, unitCost: 280, warehouseLocation: "Rack D1", companyId: pm.id },
    { itemCode: "ITEM-00006", name: "GI Corrugated Sheet 0.5mm", category: "Roofing", unit: "sqm", currentStock: 350, openingStock: 500, minimumStock: 100, unitCost: 18, warehouseLocation: "Outdoor-1", companyId: pm.id },
    { itemCode: "ITEM-00007", name: "Cement Blocks 400x200x200mm", category: "Civil", unit: "nos", currentStock: 1200, openingStock: 2000, minimumStock: 500, unitCost: 2, warehouseLocation: "Yard-A", companyId: ep.id },
    { itemCode: "ITEM-00008", name: "HDPE Water Tank 500L", category: "Plumbing", unit: "nos", currentStock: 3, openingStock: 10, minimumStock: 5, unitCost: 450, warehouseLocation: "Rack E1", companyId: ep.id },
  ]).returning();

  // Stock Entries
  await db.insert(stockEntriesTable).values([
    { entryNumber: "SE-2026-00001", type: "stock_in", itemId: item1.id, quantity: 500, unit: "kg", reference: "PM-PO-2026-0001", notes: "Received from Emirates Steel", approvalStatus: "approved", createdById: users.find(u => u.email === "priya@primemax.ae")?.id, companyId: pm.id },
    { entryNumber: "SE-2026-00002", type: "stock_out", itemId: item1.id, quantity: 200, unit: "kg", reference: "PM-PRJ-2026-0002", notes: "Issued for Labour Camp project", approvalStatus: "approved", createdById: users.find(u => u.email === "priya@primemax.ae")?.id, companyId: pm.id },
    { entryNumber: "SE-2026-00003", type: "stock_out", itemId: item4.id, quantity: 5, unit: "nos", reference: "PM-PRJ-2026-0002", notes: "Issued for Labour Camp project - Block A", approvalStatus: "approved", createdById: users.find(u => u.email === "priya@primemax.ae")?.id, companyId: pm.id },
  ]);

  // Assets
  await db.insert(assetsTable).values([
    { assetId: "PM-ASSET-0001", name: "Hiab Crane Truck - 5 Ton", category: "Vehicles & Equipment", purchaseDate: "2023-06-01", purchaseValue: 180000, currentLocation: "Sharjah Yard", condition: "good", status: "active", companyId: pm.id, maintenanceDate: "2026-06-01" },
    { assetId: "PM-ASSET-0002", name: "Forklift - 3 Ton Diesel", category: "Vehicles & Equipment", purchaseDate: "2022-01-15", purchaseValue: 95000, currentLocation: "Sharjah Warehouse", condition: "good", status: "active", companyId: pm.id, maintenanceDate: "2026-03-15" },
    { assetId: "PM-ASSET-0003", name: "Welding Machine Lincoln 250A", category: "Machinery", purchaseDate: "2024-03-10", purchaseValue: 8500, currentLocation: "Production Shop", condition: "excellent", status: "active", companyId: pm.id },
    { assetId: "PM-ASSET-0004", name: "Plasma Cutting Machine CNC", category: "Machinery", purchaseDate: "2023-09-20", purchaseValue: 45000, currentLocation: "Production Shop", condition: "good", status: "active", companyId: pm.id },
    { assetId: "EP-ASSET-0001", name: "Pickup Truck Ford Ranger 2024", category: "Vehicles & Equipment", purchaseDate: "2024-01-01", purchaseValue: 120000, currentLocation: "Dubai Office", condition: "excellent", status: "active", companyId: ep.id, maintenanceDate: "2026-07-01" },
    { assetId: "EP-ASSET-0002", name: "Generator 25KVA Cummins", category: "Machinery", purchaseDate: "2023-05-01", purchaseValue: 32000, currentLocation: "Dubai Site", condition: "good", status: "active", companyId: ep.id },
  ]);

  // Employees
  const [emp1, emp2, emp3, emp4, emp5] = await db.insert(employeesTable).values([
    { employeeId: "EMP-00001", name: "Ahmad Al-Rashidi", type: "staff", designation: "Sales Manager", departmentId: salesDept.id, companyId: pm.id, phone: "+971-50-100-0002", email: "ahmad@primemax.ae", nationality: "UAE", joiningDate: "2022-01-01" },
    { employeeId: "EMP-00002", name: "Ravi Kumar", type: "staff", designation: "Procurement Officer", departmentId: procDept.id, companyId: pm.id, phone: "+971-50-100-0006", nationality: "India", joiningDate: "2021-06-15" },
    { employeeId: "EMP-00003", name: "Ramesh Kumar", type: "labor", designation: "Steel Fabricator", companyId: pm.id, phone: "+971-52-111-2233", nationality: "India", siteLocation: "Sharjah Factory", joiningDate: "2022-08-01" },
    { employeeId: "EMP-00004", name: "Sanjay Singh", type: "labor", designation: "Welder", companyId: pm.id, phone: "+971-52-222-3344", nationality: "India", siteLocation: "Sharjah Factory", joiningDate: "2023-01-10" },
    { employeeId: "EMP-00005", name: "Mohammed Ali Hassan", type: "labor", designation: "Helper", companyId: ep.id, phone: "+971-52-333-4455", nationality: "Pakistan", siteLocation: "Dubai Expo Site", joiningDate: "2023-11-20" },
  ]).returning();

  // Attendance
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  await db.insert(attendanceTable).values([
    { employeeId: emp1.id, date: today, checkIn: "08:05", checkOut: "17:30", status: "present", latitude: 25.3287, longitude: 55.4382 },
    { employeeId: emp2.id, date: today, checkIn: "08:00", checkOut: "17:00", status: "present" },
    { employeeId: emp3.id, date: today, checkIn: "07:45", checkOut: "17:45", overtime: 0.75, status: "present", latitude: 25.3456, longitude: 55.5678 },
    { employeeId: emp4.id, date: today, status: "absent" },
    { employeeId: emp5.id, date: today, checkIn: "08:30", checkOut: "17:30", status: "present" },
    { employeeId: emp1.id, date: yesterday, checkIn: "08:10", checkOut: "17:15", status: "present" },
    { employeeId: emp3.id, date: yesterday, checkIn: "07:50", checkOut: "18:00", overtime: 1, status: "present" },
  ]);

  // Bank Accounts
  const [bank1, bank2] = await db.insert(bankAccountsTable).values([
    { bankName: "Emirates NBD", accountName: "Prime Max Prefab Houses Industry LLC", accountNumber: "1234567890101", iban: "AE070331234567890101001", swiftCode: "EBILAEAD", currency: "AED", companyId: pm.id },
    { bankName: "Abu Dhabi Commercial Bank", accountName: "Prime Max Prefab Houses Industry LLC", accountNumber: "9876543210", iban: "AE470030009876543210001", swiftCode: "ADCBAEAA", currency: "AED", companyId: pm.id },
    { bankName: "Mashreq Bank", accountName: "Elite Pre-Fabricated Houses Trading Co. LLC", accountNumber: "5555666677778", iban: "AE200330005555666677778", swiftCode: "BOMLAEAD", currency: "AED", companyId: ep.id },
  ]).returning();

  // Cheques
  await db.insert(chequesTable).values([
    { chequeNumber: "000001", bankAccountId: bank1.id, payeeName: "Emirates Steel Structures LLC", amount: 100000, amountInWords: "One Hundred Thousand UAE Dirhams Only", chequeDate: "2026-05-01", status: "approved", supplierId: suppliers[0].id, companyId: pm.id, preparedById: users.find(u => u.email === "sara@primemax.ae")?.id },
    { chequeNumber: "000002", bankAccountId: bank1.id, payeeName: "Gulf Insulation Materials", amount: 45000, amountInWords: "Forty Five Thousand UAE Dirhams Only", chequeDate: "2026-05-15", status: "draft", supplierId: suppliers[1].id, companyId: pm.id, preparedById: users.find(u => u.email === "sara@primemax.ae")?.id },
  ]);

  // Expenses
  await db.insert(expensesTable).values([
    { expenseNumber: "EXP-2026-00001", category: "office", amount: 2500, vatAmount: 125, total: 2625, paymentMethod: "bank_transfer", paymentDate: "2026-04-05", status: "approved", companyId: pm.id, description: "Office rent - April 2026", createdById: users.find(u => u.email === "sara@primemax.ae")?.id },
    { expenseNumber: "EXP-2026-00002", category: "transport", amount: 800, vatAmount: 0, total: 800, paymentMethod: "cash", paymentDate: "2026-04-10", status: "approved", companyId: pm.id, description: "Fuel expense for site visit", createdById: users.find(u => u.email === "ahmad@primemax.ae")?.id },
    { expenseNumber: "EXP-2026-00003", category: "utilities", amount: 3200, vatAmount: 160, total: 3360, paymentMethod: "bank_transfer", paymentDate: "2026-04-15", status: "pending", companyId: ep.id, description: "Electricity bill - Workshop", createdById: users.find(u => u.email === "fatima@eliteprefab.ae")?.id },
  ]);

  // Audit Logs
  await db.insert(auditLogsTable).values([
    { userId: 1, userName: "Super Admin", action: "create", entity: "lead", entityId: 1, details: "Created lead: Al Barari Villas Project" },
    { userId: 2, userName: "Ahmad Al-Rashidi", action: "update", entity: "lead", entityId: 1, details: "Updated lead status to qualified" },
    { userId: 2, userName: "Ahmad Al-Rashidi", action: "create", entity: "quotation", entityId: 1, details: "Created quotation PM-QTN-2026-0001 for Gulf Construction LLC" },
    { userId: 3, userName: "Sara Hassan", action: "create", entity: "invoice", entityId: 1, details: "Created tax invoice PM-INV-2026-0001" },
    { userId: 1, userName: "Super Admin", action: "approve", entity: "quotation", entityId: 1, details: "Approved quotation PM-QTN-2026-0001" },
  ]);

  // Notifications
  await db.insert(notificationsTable).values([
    { title: "New Lead Assigned", message: "You have been assigned a new hot lead: Al Barari Villas Project (Budget: AED 1.5M)", type: "info", isRead: false, userId: 2, entityType: "lead", entityId: 1 },
    { title: "Quotation Pending Approval", message: "Quotation PM-QTN-2026-0001 for Gulf Construction LLC is awaiting your approval", type: "warning", isRead: false, userId: 1, entityType: "quotation", entityId: 1 },
    { title: "Low Stock Alert", message: "Steel Door Frame 900x2100mm is below minimum stock level (8 units, minimum: 10)", type: "error", isRead: false, userId: 1, entityType: "inventory_item", entityId: 4 },
    { title: "Invoice Payment Received", message: "Full payment received for PM-INV-2026-0001 (AED 115,000) from Emirates Catering", type: "success", isRead: true, userId: 3, entityType: "invoice", entityId: 1 },
    { title: "Purchase Order Confirmed", message: "PO PM-PO-2026-0001 from Emirates Steel Structures LLC has been confirmed", type: "info", isRead: false, userId: 6, entityType: "purchase_order", entityId: 1 },
  ]);

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
