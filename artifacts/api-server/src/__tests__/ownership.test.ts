/**
 * Integration tests for per-user / per-team ownership scoping across CRM
 * and Sales modules. Verifies that:
 *
 *   (a) salesperson sees only their own records on LIST/GET,
 *   (b) salesperson cannot PUT/DELETE another user's records,
 *   (c) manager / department_admin sees teammates' records but only within
 *       their company scope,
 *   (d) manager with empty companyScope sees only self,
 *   (e) contacts visibility follows owned lead.companyName and is restricted
 *       by the caller's company scope,
 *   (f) DELETE on /proforma-invoices/:id and /lpos/:id is forbidden when
 *       owner / company scope fails.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";

// SESSION_SECRET must exist before importing app/auth modules that read it.
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars-long";
}
process.env.PORT = process.env.PORT ?? "0";

const { default: app } = await import("../app");
const {
  db,
  companiesTable,
  departmentsTable,
  usersTable,
  leadsTable,
  contactsTable,
  dealsTable,
  quotationsTable,
  proformaInvoicesTable,
  lposTable,
  activitiesTable,
  userCompanyAccessTable,
  userPermissionsTable,
} = await import("@workspace/db");
const { generateToken } = await import("../lib/auth");
const { eq, inArray } = await import("drizzle-orm");

const TAG = `t17-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const tag = (s: string) => `${TAG}-${s}`;

// Allow overriding common module permissions via user_permissions so that
// each test isolates ownership/scope checks (not RBAC matrix gaps).
async function grantAll(userId: number, modules: string[]) {
  for (const module of modules) {
    await db.insert(userPermissionsTable).values({
      userId,
      module,
      canView: true,
      canCreate: true,
      canEdit: true,
      canApprove: true,
      canDelete: true,
      canExport: true,
      canPrint: true,
    });
  }
}

interface TestUser {
  id: number;
  token: string;
  name: string;
}

const created = {
  companies: [] as number[],
  departments: [] as number[],
  users: [] as number[],
  leads: [] as number[],
  contacts: [] as number[],
  deals: [] as number[],
  quotations: [] as number[],
  proformaInvoices: [] as number[],
  lpos: [] as number[],
  activities: [] as number[],
};

let companyA: number;
let companyB: number;
let departmentSales: number;
let departmentOther: number;

let salesA: TestUser;
let salesB: TestUser;
let salesC2: TestUser; // salesperson in companyB
let manager: TestUser; // manager of departmentSales in companyA (sees A & B)
let deptAdmin: TestUser; // department_admin in departmentSales + companyA
let lonelyManager: TestUser; // manager with empty company scope -> sees only self
let admin: TestUser; // company_admin in companyA

const RESTRICTED_MODULES = [
  "leads",
  "contacts",
  "deals",
  "activities",
  "quotations",
  "proforma_invoices",
  "lpos",
];

async function makeUser(opts: {
  name: string;
  permissionLevel: string;
  departmentId: number | null;
  companyId: number | null;
  companyAccess: number[];
}): Promise<TestUser> {
  const email = `${tag(opts.name.toLowerCase())}@example.com`;
  const [u] = await db
    .insert(usersTable)
    .values({
      name: tag(opts.name),
      email,
      passwordHash: "x",
      role: "sales",
      departmentId: opts.departmentId,
      companyId: opts.companyId,
      permissionLevel: opts.permissionLevel,
      isActive: true,
    })
    .returning();
  created.users.push(u.id);
  for (const cid of opts.companyAccess) {
    await db.insert(userCompanyAccessTable).values({
      userId: u.id,
      companyId: cid,
      isPrimary: cid === opts.companyId,
    });
  }
  await grantAll(u.id, RESTRICTED_MODULES);
  return { id: u.id, token: generateToken(u.id), name: u.name };
}

async function createLead(ownerId: number, companyId: number, companyName: string, label: string) {
  const [l] = await db
    .insert(leadsTable)
    .values({
      leadNumber: tag(`LEAD-${label}`),
      leadName: tag(`lead-${label}`),
      companyName,
      assignedToId: ownerId,
      companyId,
      status: "new",
    })
    .returning();
  created.leads.push(l.id);
  return l;
}

async function createContact(companyName: string, companyId: number | null, label: string) {
  const [c] = await db
    .insert(contactsTable)
    .values({
      name: tag(`contact-${label}`),
      companyName,
      companyId,
    })
    .returning();
  created.contacts.push(c.id);
  return c;
}

async function createDeal(ownerId: number, companyId: number, label: string) {
  const [d] = await db
    .insert(dealsTable)
    .values({
      dealNumber: tag(`DEAL-${label}`),
      title: tag(`deal-${label}`),
      assignedToId: ownerId,
      companyId,
      stage: "new",
    })
    .returning();
  created.deals.push(d.id);
  return d;
}

async function createQuotation(preparedById: number, companyId: number, label: string) {
  const [q] = await db
    .insert(quotationsTable)
    .values({
      quotationNumber: tag(`Q-${label}`),
      companyId,
      clientName: tag(`client-${label}`),
      preparedById,
      status: "draft",
    })
    .returning();
  created.quotations.push(q.id);
  return q;
}

async function createProforma(preparedById: number, companyId: number, label: string) {
  const [pi] = await db
    .insert(proformaInvoicesTable)
    .values({
      piNumber: tag(`PI-${label}`),
      companyId,
      clientName: tag(`pi-${label}`),
      preparedById,
      total: 0,
    })
    .returning();
  created.proformaInvoices.push(pi.id);
  return pi;
}

async function createLpo(quotationId: number | null, companyId: number, label: string) {
  const [l] = await db
    .insert(lposTable)
    .values({
      lpoNumber: tag(`LPO-${label}`),
      companyId,
      clientName: tag(`lpo-${label}`),
      quotationId,
      lpoValue: 0,
    })
    .returning();
  created.lpos.push(l.id);
  return l;
}

async function createActivity(createdById: number, leadId: number, label: string) {
  const [a] = await db
    .insert(activitiesTable)
    .values({
      type: "call",
      subject: tag(`act-${label}`),
      leadId,
      createdById,
    })
    .returning();
  created.activities.push(a.id);
  return a;
}

beforeAll(async () => {
  // Companies
  const [cA] = await db
    .insert(companiesTable)
    .values({ name: tag("CompanyA"), shortName: "CA", prefix: `${TAG}-A` })
    .returning();
  const [cB] = await db
    .insert(companiesTable)
    .values({ name: tag("CompanyB"), shortName: "CB", prefix: `${TAG}-B` })
    .returning();
  companyA = cA.id;
  companyB = cB.id;
  created.companies.push(cA.id, cB.id);

  // Departments
  const [dSales] = await db
    .insert(departmentsTable)
    .values({ name: tag("Sales") })
    .returning();
  const [dOther] = await db
    .insert(departmentsTable)
    .values({ name: tag("Other") })
    .returning();
  departmentSales = dSales.id;
  departmentOther = dOther.id;
  created.departments.push(dSales.id, dOther.id);

  // Users
  salesA = await makeUser({
    name: "salesA",
    permissionLevel: "user",
    departmentId: departmentSales,
    companyId: companyA,
    companyAccess: [companyA],
  });
  salesB = await makeUser({
    name: "salesB",
    permissionLevel: "user",
    departmentId: departmentSales,
    companyId: companyA,
    companyAccess: [companyA],
  });
  salesC2 = await makeUser({
    name: "salesC2",
    permissionLevel: "user",
    departmentId: departmentSales,
    companyId: companyB,
    companyAccess: [companyB],
  });
  manager = await makeUser({
    name: "manager",
    permissionLevel: "manager",
    departmentId: departmentSales,
    companyId: companyA,
    companyAccess: [companyA],
  });
  deptAdmin = await makeUser({
    name: "deptAdmin",
    permissionLevel: "department_admin",
    departmentId: departmentSales,
    companyId: companyA,
    companyAccess: [companyA],
  });
  lonelyManager = await makeUser({
    name: "lonelyMgr",
    permissionLevel: "manager",
    departmentId: departmentSales,
    companyId: null,
    companyAccess: [],
  });
  admin = await makeUser({
    name: "admin",
    permissionLevel: "company_admin",
    departmentId: departmentOther,
    companyId: companyA,
    companyAccess: [companyA],
  });
});

afterAll(async () => {
  // Order matters for FK-free schema but keep tidy regardless.
  if (created.activities.length)
    await db.delete(activitiesTable).where(inArray(activitiesTable.id, created.activities));
  if (created.lpos.length) await db.delete(lposTable).where(inArray(lposTable.id, created.lpos));
  if (created.proformaInvoices.length)
    await db
      .delete(proformaInvoicesTable)
      .where(inArray(proformaInvoicesTable.id, created.proformaInvoices));
  if (created.quotations.length)
    await db.delete(quotationsTable).where(inArray(quotationsTable.id, created.quotations));
  if (created.deals.length) await db.delete(dealsTable).where(inArray(dealsTable.id, created.deals));
  if (created.contacts.length)
    await db.delete(contactsTable).where(inArray(contactsTable.id, created.contacts));
  if (created.leads.length) await db.delete(leadsTable).where(inArray(leadsTable.id, created.leads));
  if (created.users.length) {
    await db
      .delete(userPermissionsTable)
      .where(inArray(userPermissionsTable.userId, created.users));
    await db
      .delete(userCompanyAccessTable)
      .where(inArray(userCompanyAccessTable.userId, created.users));
    await db.delete(usersTable).where(inArray(usersTable.id, created.users));
  }
  if (created.departments.length)
    await db
      .delete(departmentsTable)
      .where(inArray(departmentsTable.id, created.departments));
  if (created.companies.length)
    await db.delete(companiesTable).where(inArray(companiesTable.id, created.companies));
});

const auth = (u: TestUser) => ({ Authorization: `Bearer ${u.token}` });

// ---------------------------------------------------------------------------
// (a) Salesperson sees only their own records on LIST/GET
// ---------------------------------------------------------------------------

describe("(a) salesperson sees only their own records", () => {
  it("LIST /leads returns only own assignments and 403s on others", async () => {
    const lA = await createLead(salesA.id, companyA, tag("ACME"), "a-list");
    const lB = await createLead(salesB.id, companyA, tag("UMBR"), "b-list");

    const res = await request(app).get("/api/leads").set(auth(salesA));
    expect(res.status).toBe(200);
    const rows = res.body as Array<{ id: number; assignedToId: number | null }>;
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(lA.id);
    expect(ids).not.toContain(lB.id);
    // Tightened: every returned row must be owned by salesA.
    for (const r of rows) {
      expect(r.assignedToId).toBe(salesA.id);
    }

    const own = await request(app).get(`/api/leads/${lA.id}`).set(auth(salesA));
    expect(own.status).toBe(200);
    const other = await request(app).get(`/api/leads/${lB.id}`).set(auth(salesA));
    expect(other.status).toBe(403);
  });

  it("LIST /deals only includes own; GET other 403", async () => {
    const dA = await createDeal(salesA.id, companyA, "a-deal");
    const dB = await createDeal(salesB.id, companyA, "b-deal");
    const res = await request(app).get("/api/deals").set(auth(salesA));
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: number }>).map((r) => r.id);
    expect(ids).toContain(dA.id);
    expect(ids).not.toContain(dB.id);
    const otherGet = await request(app).get(`/api/deals/${dB.id}`).set(auth(salesA));
    expect(otherGet.status).toBe(403);
  });

  it("LIST /quotations only includes own; GET other 403", async () => {
    const qA = await createQuotation(salesA.id, companyA, "a-qt");
    const qB = await createQuotation(salesB.id, companyA, "b-qt");
    const res = await request(app).get("/api/quotations").set(auth(salesA));
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: number }>).map((r) => r.id);
    expect(ids).toContain(qA.id);
    expect(ids).not.toContain(qB.id);
    const otherGet = await request(app).get(`/api/quotations/${qB.id}`).set(auth(salesA));
    expect(otherGet.status).toBe(403);
  });

  it("LIST /proforma-invoices only includes own; GET other 403", async () => {
    const pA = await createProforma(salesA.id, companyA, "a-pi");
    const pB = await createProforma(salesB.id, companyA, "b-pi");
    const res = await request(app).get("/api/proforma-invoices").set(auth(salesA));
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: number }>).map((r) => r.id);
    expect(ids).toContain(pA.id);
    expect(ids).not.toContain(pB.id);
    const otherGet = await request(app).get(`/api/proforma-invoices/${pB.id}`).set(auth(salesA));
    expect(otherGet.status).toBe(403);
  });

  it("LIST /activities only includes own (createdById)", async () => {
    const lA = await createLead(salesA.id, companyA, tag("ACT-A-CO"), "a-act-lead");
    const lB = await createLead(salesB.id, companyA, tag("ACT-B-CO"), "b-act-lead");
    const aA = await createActivity(salesA.id, lA.id, "a-act");
    const aB = await createActivity(salesB.id, lB.id, "b-act");
    const res = await request(app).get("/api/activities").set(auth(salesA));
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: number }>).map((r) => r.id);
    expect(ids).toContain(aA.id);
    expect(ids).not.toContain(aB.id);
  });

  it("LPO LIST scopes via linked quotation owners", async () => {
    const qA = await createQuotation(salesA.id, companyA, "a-qt-lpo");
    const qB = await createQuotation(salesB.id, companyA, "b-qt-lpo");
    const lpoA = await createLpo(qA.id, companyA, "a-lpo");
    const lpoB = await createLpo(qB.id, companyA, "b-lpo");
    const res = await request(app).get("/api/lpos").set(auth(salesA));
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: number }>).map((r) => r.id);
    expect(ids).toContain(lpoA.id);
    expect(ids).not.toContain(lpoB.id);
    const otherGet = await request(app).get(`/api/lpos/${lpoB.id}`).set(auth(salesA));
    expect(otherGet.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// (b) Salesperson cannot PUT/DELETE another user's records
// ---------------------------------------------------------------------------

describe("(b) salesperson cannot mutate another user's records", () => {
  it("PUT/DELETE /leads/:id of another user → 403", async () => {
    const lB = await createLead(salesB.id, companyA, tag("MUT"), "b-mut");
    const put = await request(app)
      .put(`/api/leads/${lB.id}`)
      .set(auth(salesA))
      .send({ leadName: "hacked", companyId: companyA });
    expect(put.status).toBe(403);
    const del = await request(app).delete(`/api/leads/${lB.id}`).set(auth(salesA));
    expect(del.status).toBe(403);
  });

  it("PUT/DELETE /deals/:id of another user → 403", async () => {
    const dB = await createDeal(salesB.id, companyA, "b-mut-deal");
    const put = await request(app)
      .put(`/api/deals/${dB.id}`)
      .set(auth(salesA))
      .send({ title: "hacked", companyId: companyA });
    expect(put.status).toBe(403);
    const del = await request(app).delete(`/api/deals/${dB.id}`).set(auth(salesA));
    expect(del.status).toBe(403);
  });

  it("PUT/DELETE /quotations/:id of another user → 403", async () => {
    const qB = await createQuotation(salesB.id, companyA, "b-mut-q");
    const put = await request(app)
      .put(`/api/quotations/${qB.id}`)
      .set(auth(salesA))
      .send({ companyId: companyA, clientName: "hacked", items: [] });
    expect(put.status).toBe(403);
    const del = await request(app).delete(`/api/quotations/${qB.id}`).set(auth(salesA));
    expect(del.status).toBe(403);
  });

  it("PUT/DELETE /activities/:id of another user → 403", async () => {
    const lB = await createLead(salesB.id, companyA, tag("MUT-ACT-CO"), "b-mut-act-lead");
    const aB = await createActivity(salesB.id, lB.id, "b-mut-act");
    const put = await request(app)
      .put(`/api/activities/${aB.id}`)
      .set(auth(salesA))
      .send({ subject: "hacked" });
    expect(put.status).toBe(403);
    const del = await request(app).delete(`/api/activities/${aB.id}`).set(auth(salesA));
    expect(del.status).toBe(403);
  });

  it("PUT/DELETE /contacts/:id whose companyName isn't owned → 403", async () => {
    const otherClient = tag("CONTACT-MUT-OTHER");
    await createLead(salesB.id, companyA, otherClient, "b-mut-contact-lead");
    const c = await createContact(otherClient, companyA, "b-mut-contact");
    const put = await request(app)
      .put(`/api/contacts/${c.id}`)
      .set(auth(salesA))
      .send({ name: "hacked", companyName: otherClient, companyId: companyA });
    expect(put.status).toBe(403);
    const del = await request(app).delete(`/api/contacts/${c.id}`).set(auth(salesA));
    expect(del.status).toBe(403);
  });

  it("PUT /proforma-invoices/:id of another user → 403", async () => {
    const pi = await createProforma(salesB.id, companyA, "b-mut-pi");
    const put = await request(app)
      .put(`/api/proforma-invoices/${pi.id}`)
      .set(auth(salesA))
      .send({ companyId: companyA, clientName: "hacked" });
    expect(put.status).toBe(403);
  });

  it("PUT /lpos/:id whose linked quotation belongs to another user → 403", async () => {
    const qB = await createQuotation(salesB.id, companyA, "b-mut-lpo-q");
    const lpo = await createLpo(qB.id, companyA, "b-mut-lpo");
    const put = await request(app)
      .put(`/api/lpos/${lpo.id}`)
      .set(auth(salesA))
      .send({ companyId: companyA, clientName: "hacked" });
    expect(put.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// (c) Manager / department_admin sees teammates within company scope
// ---------------------------------------------------------------------------

describe("(c) manager sees teammates' records within company scope", () => {
  it("manager LIST /leads includes salesA and salesB but not cross-company salesC2", async () => {
    const lA = await createLead(salesA.id, companyA, tag("MGR-A"), "mgr-a");
    const lB = await createLead(salesB.id, companyA, tag("MGR-B"), "mgr-b");
    const lC = await createLead(salesC2.id, companyB, tag("MGR-C"), "mgr-c");
    const res = await request(app).get("/api/leads").set(auth(manager));
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: number }>).map((r) => r.id);
    expect(ids).toContain(lA.id);
    expect(ids).toContain(lB.id);
    expect(ids).not.toContain(lC.id);
  });

  it("manager LIST /quotations includes teammates'", async () => {
    const qA = await createQuotation(salesA.id, companyA, "mgr-qA");
    const qB = await createQuotation(salesB.id, companyA, "mgr-qB");
    const res = await request(app).get("/api/quotations").set(auth(manager));
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: number }>).map((r) => r.id);
    expect(ids).toContain(qA.id);
    expect(ids).toContain(qB.id);
  });

  it("department_admin LIST /leads includes teammates but excludes cross-company", async () => {
    const lA = await createLead(salesA.id, companyA, tag("DA-A"), "da-a");
    const lB = await createLead(salesB.id, companyA, tag("DA-B"), "da-b");
    const lC = await createLead(salesC2.id, companyB, tag("DA-C"), "da-c");
    const res = await request(app).get("/api/leads").set(auth(deptAdmin));
    expect(res.status).toBe(200);
    const rows = res.body as Array<{ id: number; assignedToId: number | null }>;
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(lA.id);
    expect(ids).toContain(lB.id);
    expect(ids).not.toContain(lC.id);
    // Tighten: every returned record we tagged is owned by a known teammate.
    const allowedOwners = new Set([salesA.id, salesB.id, manager.id, deptAdmin.id]);
    const ours = rows.filter((r) => [lA.id, lB.id, lC.id].includes(r.id));
    for (const r of ours) {
      expect(r.assignedToId == null || allowedOwners.has(r.assignedToId)).toBe(true);
    }
  });

  it("department_admin LIST /quotations includes teammates' but not cross-company", async () => {
    const qA = await createQuotation(salesA.id, companyA, "da-qA");
    const qB = await createQuotation(salesB.id, companyA, "da-qB");
    const qC = await createQuotation(salesC2.id, companyB, "da-qC");
    const res = await request(app).get("/api/quotations").set(auth(deptAdmin));
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: number }>).map((r) => r.id);
    expect(ids).toContain(qA.id);
    expect(ids).toContain(qB.id);
    expect(ids).not.toContain(qC.id);
  });
});

// ---------------------------------------------------------------------------
// (d) Manager with empty companyScope sees only self
// ---------------------------------------------------------------------------

describe("(d) manager with empty companyScope sees only self", () => {
  it("LIST /leads excludes teammate leads even within same department", async () => {
    // Use companyId=null so scopeFilter (which keeps null-company rows) does
    // not pre-filter the rows; this isolates the owner-scope behavior.
    const [lTeammate] = await db
      .insert(leadsTable)
      .values({
        leadNumber: tag("LEAD-LON-TEAM"),
        leadName: tag("lead-lon-team"),
        assignedToId: salesA.id,
        companyId: null,
        status: "new",
      })
      .returning();
    created.leads.push(lTeammate.id);
    const [lSelf] = await db
      .insert(leadsTable)
      .values({
        leadNumber: tag("LEAD-LON-SELF"),
        leadName: tag("lead-lon-self"),
        assignedToId: lonelyManager.id,
        companyId: null,
        status: "new",
      })
      .returning();
    created.leads.push(lSelf.id);

    const res = await request(app).get("/api/leads").set(auth(lonelyManager));
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: number }>).map((r) => r.id);
    expect(ids).toContain(lSelf.id);
    expect(ids).not.toContain(lTeammate.id);
  });
});

// ---------------------------------------------------------------------------
// (e) Contacts visibility follows owned lead.companyName, restricted by scope
// ---------------------------------------------------------------------------

describe("(e) contacts follow owned lead.companyName within company scope", () => {
  it("salesperson sees only contacts whose companyName matches their owned leads", async () => {
    const ownedClient = tag("CONTACT-OWNED");
    const otherClient = tag("CONTACT-OTHER");
    await createLead(salesA.id, companyA, ownedClient, "contact-own");
    await createLead(salesB.id, companyA, otherClient, "contact-other");

    const cMine = await createContact(ownedClient, companyA, "mine");
    const cOther = await createContact(otherClient, companyA, "other");
    // Same companyName as A's lead but in companyB → must be blocked by company scope.
    const cCrossCompany = await createContact(ownedClient, companyB, "cross");

    const res = await request(app).get("/api/contacts").set(auth(salesA));
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: number }>).map((r) => r.id);
    expect(ids).toContain(cMine.id);
    expect(ids).not.toContain(cOther.id);
    expect(ids).not.toContain(cCrossCompany.id);

    const okGet = await request(app).get(`/api/contacts/${cMine.id}`).set(auth(salesA));
    expect(okGet.status).toBe(200);
    const blocked = await request(app).get(`/api/contacts/${cOther.id}`).set(auth(salesA));
    expect(blocked.status).toBe(403);
    const blockedCross = await request(app)
      .get(`/api/contacts/${cCrossCompany.id}`)
      .set(auth(salesA));
    expect(blockedCross.status).toBe(403);
  });

  it("admin still sees contacts across owners (sanity)", async () => {
    const adminClient = tag("CONTACT-ADMIN");
    const c = await createContact(adminClient, companyA, "admin-visible");
    const res = await request(app).get("/api/contacts").set(auth(admin));
    expect(res.status).toBe(200);
    const ids = (res.body as Array<{ id: number }>).map((r) => r.id);
    expect(ids).toContain(c.id);
  });
});

// ---------------------------------------------------------------------------
// (f) DELETE on /proforma-invoices/:id and /lpos/:id — owner/company scope fail
// ---------------------------------------------------------------------------

describe("(f) DELETE forbidden when owner/company scope fails", () => {
  it("DELETE /proforma-invoices/:id of another user (owner-scope fail) → 403", async () => {
    const pi = await createProforma(salesB.id, companyA, "f-pi-owner");
    const res = await request(app).delete(`/api/proforma-invoices/${pi.id}`).set(auth(salesA));
    expect(res.status).toBe(403);
    // Sanity: still present in DB.
    const row = await db
      .select()
      .from(proformaInvoicesTable)
      .where(eq(proformaInvoicesTable.id, pi.id));
    expect(row.length).toBe(1);
  });

  it("DELETE /proforma-invoices/:id in another company (company-scope fail) → 403", async () => {
    const pi = await createProforma(salesC2.id, companyB, "f-pi-company");
    const res = await request(app).delete(`/api/proforma-invoices/${pi.id}`).set(auth(salesA));
    expect(res.status).toBe(403);
  });

  it("DELETE /lpos/:id of another user's quotation (owner-scope fail) → 403", async () => {
    const qB = await createQuotation(salesB.id, companyA, "f-lpo-q");
    const lpo = await createLpo(qB.id, companyA, "f-lpo-owner");
    const res = await request(app).delete(`/api/lpos/${lpo.id}`).set(auth(salesA));
    expect(res.status).toBe(403);
    const row = await db.select().from(lposTable).where(eq(lposTable.id, lpo.id));
    expect(row.length).toBe(1);
  });

  it("DELETE /lpos/:id in another company (company-scope fail) → 403", async () => {
    const qC = await createQuotation(salesC2.id, companyB, "f-lpo-q-cb");
    const lpo = await createLpo(qC.id, companyB, "f-lpo-company");
    const res = await request(app).delete(`/api/lpos/${lpo.id}`).set(auth(salesA));
    expect(res.status).toBe(403);
  });
});
