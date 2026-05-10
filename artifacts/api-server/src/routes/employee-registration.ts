import { Router } from "express";
import { db, employeeRegistrationsTable, employeeRegDocumentsTable, employeeRegExperienceTable, employeeRegEducationTable, employeeRegRelativesTable, departmentsTable, companiesTable } from "@workspace/db";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, inScope } from "../middlewares/auth";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";
import { audit } from "../lib/audit";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB per document (base64)

function deptCodeFromName(name: string): string {
  const MAP: Record<string, string> = {
    hr: "HRD", "human resources": "HRD",
    accounts: "ACC", accounting: "ACC", finance: "FIN",
    sales: "SAL", "sales & marketing": "SAL",
    procurement: "PRO", purchasing: "PRO",
    inventory: "INV", store: "STO",
    projects: "PRJ", project: "PRJ",
    assets: "AST",
    admin: "ADM", administration: "ADM",
    engineering: "ENG",
    operations: "OPS",
    it: "ITC", "information technology": "ITC",
    marketing: "MKT",
    legal: "LEG",
    security: "SEC",
  };
  const key = name.toLowerCase().trim();
  return MAP[key] ?? name.replace(/\s+/g, "").slice(0, 3).toUpperCase();
}

async function nextRegCode(companyId: number): Promise<string> {
  const yr = new Date().getFullYear();
  await db.execute(sql`SELECT pg_advisory_xact_lock(${sql.raw(String(companyId + 9000))})`);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(employeeRegistrationsTable)
    .where(sql`company_id = ${companyId} AND reg_code LIKE ${"EMP-" + yr + "-%"}`);
  const seq = (count ?? 0) + 1;
  return `EMP-${yr}-${String(seq).padStart(4, "0")}`;
}

function buildRegistrationLink(token: string, req: { protocol: string; get(h: string): string | undefined }): string {
  const proto = process.env.NODE_ENV === "production" ? "https" : req.protocol;
  const host = req.get("host") ?? "localhost";
  return `${proto}://${host}/employee-register/${token}`;
}

async function fullRegistration(id: number) {
  const [reg] = await db.select().from(employeeRegistrationsTable).where(eq(employeeRegistrationsTable.id, id));
  if (!reg) return null;
  const [documents, experience, education, relatives] = await Promise.all([
    db.select().from(employeeRegDocumentsTable).where(eq(employeeRegDocumentsTable.registrationId, id)).orderBy(employeeRegDocumentsTable.uploadedAt),
    db.select().from(employeeRegExperienceTable).where(eq(employeeRegExperienceTable.registrationId, id)).orderBy(employeeRegExperienceTable.createdAt),
    db.select().from(employeeRegEducationTable).where(eq(employeeRegEducationTable.registrationId, id)).orderBy(employeeRegEducationTable.createdAt),
    db.select().from(employeeRegRelativesTable).where(eq(employeeRegRelativesTable.registrationId, id)).orderBy(employeeRegRelativesTable.createdAt),
  ]);
  // Strip file_data from documents list for performance (served separately)
  const docsStripped = documents.map(d => ({ ...d, fileData: d.fileData ? "[uploaded]" : null }));
  return { ...reg, documents: docsStripped, experience, education, relatives };
}

// ─── Admin routes (require auth) ─────────────────────────────────────────────

router.post("/employee-registrations", requireAuth, requirePermission("employees", "create"), async (req, res): Promise<void> => {
  const { fullName, email, mobile, designation, departmentId, companyId, joiningType, branch } = req.body as Record<string, string | number>;
  if (!fullName || !companyId) { res.status(400).json({ error: "fullName and companyId are required" }); return; }
  if (!inScope(req, Number(companyId))) { res.status(403).json({ error: "Forbidden" }); return; }

  // Get department info
  let departmentName: string | undefined;
  let deptCode = "";
  if (departmentId) {
    const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, Number(departmentId)));
    departmentName = dept?.name;
    if (departmentName) deptCode = deptCodeFromName(departmentName);
  }

  const token = randomUUID();
  const yr = new Date().getFullYear();

  const [reg] = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${sql.raw(String(Number(companyId) + 9000))})`);
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` })
      .from(employeeRegistrationsTable)
      .where(sql`company_id = ${companyId} AND reg_code LIKE ${"EMP-" + yr + "-%"}`);
    const seq = (count ?? 0) + 1;
    const regCode = `EMP-${yr}-${String(seq).padStart(4, "0")}`;
    const deptRegCode = deptCode ? `${deptCode}-EMP-${yr}-${String(seq).padStart(4, "0")}` : undefined;

    return tx.insert(employeeRegistrationsTable).values({
      regCode,
      deptRegCode: deptRegCode ?? null,
      token,
      companyId: Number(companyId),
      departmentId: departmentId ? Number(departmentId) : null,
      departmentName: departmentName ?? null,
      fullName: String(fullName),
      email: email ? String(email) : null,
      mobile: mobile ? String(mobile) : null,
      designation: designation ? String(designation) : null,
      joiningType: joiningType ? String(joiningType) : null,
      branch: branch ? String(branch) : null,
      createdById: req.user?.id,
    }).returning();
  });

  const registrationLink = buildRegistrationLink(token, req);
  await audit(req, { action: "create", entity: "employee_registration", entityId: reg.id, details: `Created registration ${reg.regCode} for ${reg.fullName}` });
  res.status(201).json({ ...reg, registrationLink });
});

router.get("/employee-registrations", requireAuth, requirePermission("employees", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(employeeRegistrationsTable).orderBy(desc(employeeRegistrationsTable.createdAt));
  rows = scopeFilter(req, rows);
  const { status, departmentId, search } = req.query;
  if (status) rows = rows.filter(r => r.status === status);
  if (departmentId) rows = rows.filter(r => r.departmentId === Number(departmentId));
  if (search) {
    const s = String(search).toLowerCase();
    rows = rows.filter(r => r.fullName.toLowerCase().includes(s) || r.regCode.toLowerCase().includes(s) || (r.email ?? "").toLowerCase().includes(s));
  }
  const proto = process.env.NODE_ENV === "production" ? "https" : req.protocol;
  const host = req.get("host") ?? "localhost";
  const result = rows.map(r => ({ ...r, registrationLink: `${proto}://${host}/employee-register/${r.token}` }));
  res.json(result);
});

router.get("/employee-registrations/:id", requireAuth, requirePermission("employees", "view"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const data = await fullRegistration(id);
  if (!data) { res.status(404).json({ error: "Not found" }); return; }
  if (!inScope(req, data.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const registrationLink = buildRegistrationLink(data.token, req);
  res.json({ ...data, registrationLink });
});

router.put("/employee-registrations/:id", requireAuth, requirePermission("employees", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select({ companyId: employeeRegistrationsTable.companyId }).from(employeeRegistrationsTable).where(eq(employeeRegistrationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!inScope(req, existing.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { status, adminRemarks, correctionNotes, linkActive } = req.body as Record<string, unknown>;
  const updates: Partial<typeof employeeRegistrationsTable.$inferInsert> = { updatedAt: new Date() };
  if (status !== undefined) updates.status = String(status);
  if (adminRemarks !== undefined) updates.adminRemarks = String(adminRemarks);
  if (correctionNotes !== undefined) updates.correctionNotes = String(correctionNotes);
  if (linkActive !== undefined) updates.linkActive = Boolean(linkActive);
  if (status === "approved") updates.approvedAt = new Date();
  if (status === "under_review") updates.reviewedAt = new Date();
  const [updated] = await db.update(employeeRegistrationsTable).set(updates).where(eq(employeeRegistrationsTable.id, id)).returning();
  await audit(req, { action: "update", entity: "employee_registration", entityId: id, details: `Updated registration status to ${updates.status ?? "unchanged"}` });
  res.json(updated);
});

router.post("/employee-registrations/:id/regenerate-link", requireAuth, requirePermission("employees", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(employeeRegistrationsTable).where(eq(employeeRegistrationsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!inScope(req, existing.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const newToken = randomUUID();
  await db.update(employeeRegistrationsTable).set({ token: newToken, linkActive: true, updatedAt: new Date() }).where(eq(employeeRegistrationsTable.id, id));
  const registrationLink = buildRegistrationLink(newToken, req);
  res.json({ token: newToken, registrationLink });
});

// Admin document verification
router.put("/employee-registrations/:id/documents/:docId", requireAuth, requirePermission("employees", "edit"), async (req, res): Promise<void> => {
  const registrationId = parseInt(String(req.params.id), 10);
  const docId = parseInt(String(req.params.docId), 10);
  const [existing] = await db.select({ companyId: employeeRegistrationsTable.companyId }).from(employeeRegistrationsTable).where(eq(employeeRegistrationsTable.id, registrationId));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!inScope(req, existing.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { status, adminRemarks } = req.body as Record<string, string>;
  const updates: Partial<typeof employeeRegDocumentsTable.$inferInsert> = {};
  if (status) updates.status = status;
  if (adminRemarks !== undefined) updates.adminRemarks = adminRemarks;
  if (status === "verified") { updates.verifiedAt = new Date(); updates.verifiedById = req.user?.id; }
  const [doc] = await db.update(employeeRegDocumentsTable).set(updates).where(and(eq(employeeRegDocumentsTable.id, docId), eq(employeeRegDocumentsTable.registrationId, registrationId))).returning();
  res.json(doc);
});

// Admin download a specific document's file data
router.get("/employee-registrations/:id/documents/:docId/download", requireAuth, requirePermission("employees", "view"), async (req, res): Promise<void> => {
  const registrationId = parseInt(String(req.params.id), 10);
  const docId = parseInt(String(req.params.docId), 10);
  const [existing] = await db.select({ companyId: employeeRegistrationsTable.companyId }).from(employeeRegistrationsTable).where(eq(employeeRegistrationsTable.id, registrationId));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!inScope(req, existing.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const [doc] = await db.select().from(employeeRegDocumentsTable).where(and(eq(employeeRegDocumentsTable.id, docId), eq(employeeRegDocumentsTable.registrationId, registrationId)));
  if (!doc || !doc.fileData) { res.status(404).json({ error: "No file" }); return; }
  res.json({ fileData: doc.fileData, fileName: doc.fileName, contentType: doc.contentType });
});

// ─── Public routes (token-based, no auth required) ───────────────────────────

// Get registration data by token
router.get("/employee-register/:token", async (req, res): Promise<void> => {
  const { token } = req.params;
  const [reg] = await db.select().from(employeeRegistrationsTable).where(and(eq(employeeRegistrationsTable.token, token), eq(employeeRegistrationsTable.linkActive, true)));
  if (!reg) { res.status(404).json({ error: "Invalid or deactivated registration link" }); return; }
  if (["approved", "rejected"].includes(reg.status)) {
    // Still let them view but signal it's locked
  }
  const [documents, experience, education, relatives, company] = await Promise.all([
    db.select().from(employeeRegDocumentsTable).where(eq(employeeRegDocumentsTable.registrationId, reg.id)).orderBy(employeeRegDocumentsTable.uploadedAt),
    db.select().from(employeeRegExperienceTable).where(eq(employeeRegExperienceTable.registrationId, reg.id)).orderBy(employeeRegExperienceTable.createdAt),
    db.select().from(employeeRegEducationTable).where(eq(employeeRegEducationTable.registrationId, reg.id)).orderBy(employeeRegEducationTable.createdAt),
    db.select().from(employeeRegRelativesTable).where(eq(employeeRegRelativesTable.registrationId, reg.id)).orderBy(employeeRegRelativesTable.createdAt),
    db.select({ name: companiesTable.name, shortName: companiesTable.shortName }).from(companiesTable).where(eq(companiesTable.id, reg.companyId)),
  ]);
  const docsStripped = documents.map(d => ({ ...d, fileData: d.fileData ? "[uploaded]" : null }));
  res.json({ registration: { ...reg, registrationLink: undefined, token: undefined }, documents: docsStripped, experience, education, relatives, company: company[0] });
});

// Auto-save form progress
router.put("/employee-register/:token/save", async (req, res): Promise<void> => {
  const { token } = req.params;
  const [reg] = await db.select().from(employeeRegistrationsTable).where(and(eq(employeeRegistrationsTable.token, token), eq(employeeRegistrationsTable.linkActive, true)));
  if (!reg) { res.status(404).json({ error: "Invalid or deactivated registration link" }); return; }
  if (["approved", "rejected"].includes(reg.status)) { res.status(400).json({ error: "Registration is locked" }); return; }

  const body = req.body as Record<string, unknown>;
  const ALLOWED_FIELDS = [
    "fatherName", "dateOfBirth", "gender", "nationality", "maritalStatus",
    "currentAddress", "permanentAddress", "currentCountry", "currentState", "currentCity",
    "homeCountry", "homeState", "homeCity", "email", "mobile",
    "emergencyContactName", "emergencyContactNumber", "emergencyContactRelationship",
    "expectedJoiningDate", "visaStatus", "uaeDrivingLicense",
    "totalExperienceYears", "gulfExperienceYears", "homeCountryExperienceYears",
    "previousCompany", "previousDesignation", "previousCompanyLocation", "reasonForLeaving",
    "skillsCategory", "salaryExpectation",
  ] as const;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ALLOWED_FIELDS) {
    if (key in body) updates[key] = body[key];
  }

  // Upsert experience
  if (Array.isArray(body.experience)) {
    await db.delete(employeeRegExperienceTable).where(eq(employeeRegExperienceTable.registrationId, reg.id));
    if (body.experience.length > 0) {
      await db.insert(employeeRegExperienceTable).values(body.experience.map((e: Record<string, unknown>) => ({ registrationId: reg.id, companyName: String(e.companyName ?? ""), country: e.country as string ?? null, city: e.city as string ?? null, designation: e.designation as string ?? null, startDate: e.startDate as string ?? null, endDate: e.endDate as string ?? null, totalDuration: e.totalDuration as string ?? null, reasonForLeaving: e.reasonForLeaving as string ?? null, jobResponsibilities: e.jobResponsibilities as string ?? null })));
    }
  }
  // Upsert education
  if (Array.isArray(body.education)) {
    await db.delete(employeeRegEducationTable).where(eq(employeeRegEducationTable.registrationId, reg.id));
    if (body.education.length > 0) {
      await db.insert(employeeRegEducationTable).values(body.education.map((e: Record<string, unknown>) => ({ registrationId: reg.id, certificateName: String(e.certificateName ?? ""), instituteName: e.instituteName as string ?? null, country: e.country as string ?? null, passingYear: e.passingYear as string ?? null, grade: e.grade as string ?? null, fileData: e.fileData as string ?? null, fileName: e.fileName as string ?? null })));
    }
  }
  // Upsert relatives
  if (Array.isArray(body.relatives)) {
    await db.delete(employeeRegRelativesTable).where(eq(employeeRegRelativesTable.registrationId, reg.id));
    if (body.relatives.length > 0) {
      await db.insert(employeeRegRelativesTable).values(body.relatives.map((r: Record<string, unknown>) => ({ registrationId: reg.id, relativeName: String(r.relativeName ?? ""), relationship: r.relationship as string ?? null, contactNumber: r.contactNumber as string ?? null, country: r.country as string ?? null, address: r.address as string ?? null, documentFileData: r.documentFileData as string ?? null, documentFileName: r.documentFileName as string ?? null })));
    }
  }

  const [updated] = await db.update(employeeRegistrationsTable).set(updates as Partial<typeof employeeRegistrationsTable.$inferInsert>).where(eq(employeeRegistrationsTable.id, reg.id)).returning();
  res.json({ ok: true, status: updated.status });
});

// Upload a document (public)
router.post("/employee-register/:token/documents", async (req, res): Promise<void> => {
  const { token } = req.params;
  const [reg] = await db.select().from(employeeRegistrationsTable).where(and(eq(employeeRegistrationsTable.token, token), eq(employeeRegistrationsTable.linkActive, true)));
  if (!reg) { res.status(404).json({ error: "Invalid or deactivated registration link" }); return; }
  if (["approved", "rejected"].includes(reg.status)) { res.status(400).json({ error: "Registration is locked" }); return; }

  const { documentType, documentName, fileData, fileName, contentType, expiryDate } = req.body as Record<string, string>;
  if (!documentType || !documentName) { res.status(400).json({ error: "documentType and documentName are required" }); return; }

  // File size check (base64 is ~33% larger than binary)
  const fileSizeBytes = fileData ? Math.round(fileData.length * 0.75) : 0;
  if (fileSizeBytes > MAX_FILE_BYTES) { res.status(400).json({ error: "File too large (max 8 MB)" }); return; }

  const [doc] = await db.insert(employeeRegDocumentsTable).values({
    registrationId: reg.id,
    documentType,
    documentName,
    fileData: fileData ?? null,
    fileName: fileName ?? null,
    contentType: contentType ?? null,
    fileSizeBytes: fileSizeBytes || null,
    expiryDate: expiryDate ?? null,
    status: "submitted",
  }).returning();

  // Update reg status to pending if still link_generated
  if (reg.status === "link_generated") {
    await db.update(employeeRegistrationsTable).set({ status: "pending", updatedAt: new Date() }).where(eq(employeeRegistrationsTable.id, reg.id));
  }

  res.status(201).json({ ...doc, fileData: null });
});

// Delete a document (public)
router.delete("/employee-register/:token/documents/:docId", async (req, res): Promise<void> => {
  const { token } = req.params;
  const docId = parseInt(req.params.docId, 10);
  const [reg] = await db.select().from(employeeRegistrationsTable).where(and(eq(employeeRegistrationsTable.token, token), eq(employeeRegistrationsTable.linkActive, true)));
  if (!reg) { res.status(404).json({ error: "Invalid link" }); return; }
  if (["approved", "rejected"].includes(reg.status)) { res.status(400).json({ error: "Registration is locked" }); return; }
  await db.delete(employeeRegDocumentsTable).where(and(eq(employeeRegDocumentsTable.id, docId), eq(employeeRegDocumentsTable.registrationId, reg.id)));
  res.json({ ok: true });
});

// Final submission (public)
router.post("/employee-register/:token/submit", async (req, res): Promise<void> => {
  const { token } = req.params;
  const [reg] = await db.select().from(employeeRegistrationsTable).where(and(eq(employeeRegistrationsTable.token, token), eq(employeeRegistrationsTable.linkActive, true)));
  if (!reg) { res.status(404).json({ error: "Invalid or deactivated registration link" }); return; }
  if (["approved", "rejected", "submitted", "under_review"].includes(reg.status)) {
    res.status(400).json({ error: "Registration already submitted or locked" }); return;
  }
  // Save all form data first
  const body = req.body as Record<string, unknown>;
  const SUBMIT_ALLOWED_FIELDS = [
    "fatherName", "dateOfBirth", "gender", "nationality", "maritalStatus",
    "currentAddress", "permanentAddress", "currentCountry", "currentState", "currentCity",
    "homeCountry", "homeState", "homeCity", "email", "mobile",
    "emergencyContactName", "emergencyContactNumber", "emergencyContactRelationship",
    "expectedJoiningDate", "visaStatus", "uaeDrivingLicense",
    "totalExperienceYears", "gulfExperienceYears", "homeCountryExperienceYears",
    "previousCompany", "previousDesignation", "previousCompanyLocation", "reasonForLeaving",
    "skillsCategory", "salaryExpectation",
  ] as const;
  const updates: Record<string, unknown> = { status: "submitted", submittedAt: new Date(), updatedAt: new Date() };
  for (const key of SUBMIT_ALLOWED_FIELDS) {
    if (key in body) updates[key] = body[key];
  }
  await db.update(employeeRegistrationsTable).set(updates as Partial<typeof employeeRegistrationsTable.$inferInsert>).where(eq(employeeRegistrationsTable.id, reg.id));
  logger.info({ regId: reg.id, regCode: reg.regCode }, "Employee registration submitted");
  res.json({ ok: true, message: "Registration submitted successfully. HR will review your application." });
});

export default router;
