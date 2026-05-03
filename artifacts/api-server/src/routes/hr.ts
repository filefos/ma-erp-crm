import { Router } from "express";
import { db, employeesTable, attendanceTable, departmentsTable, employeeAttachmentsTable, usersTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess } from "../middlewares/auth";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
router.use(requireAuth);

const storageService = new ObjectStorageService();

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function signObjectKey(objectKey: string | null | undefined): Promise<string | undefined> {
  if (!objectKey || !objectKey.startsWith("/objects/")) return undefined;
  try {
    const file = await storageService.getObjectEntityFile(objectKey);
    const [signed] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 15 * 60 * 1000,
    });
    return signed;
  } catch {
    return undefined;
  }
}

async function enrichRow(row: typeof attendanceTable.$inferSelect & { employeeName?: string }) {
  const [selfieSignedUrl, checkOutSelfieSignedUrl] = await Promise.all([
    signObjectKey(row.selfieObjectKey),
    signObjectKey(row.checkOutSelfieObjectKey),
  ]);
  return { ...row, selfieSignedUrl, checkOutSelfieSignedUrl };
}

async function enrichEmployee(e: typeof employeesTable.$inferSelect): Promise<any> {
  let departmentName: string | undefined;
  if (e.departmentId) {
    const [dept] = await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, e.departmentId));
    departmentName = dept?.name;
  }
  const photoSignedUrl = await signObjectKey(e.photoObjectKey);
  return { ...e, departmentName, photoSignedUrl };
}

// Employees
router.get("/employees", requirePermission("employees", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(employeesTable).orderBy(employeesTable.name);
  rows = scopeFilter(req, rows);
  const { departmentId, companyId, type, search } = req.query;
  if (departmentId) rows = rows.filter(r => r.departmentId === parseInt(departmentId as string, 10));
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (type) rows = rows.filter(r => r.type === type);
  if (search) {
    const s = (search as string).toLowerCase();
    rows = rows.filter(r => r.name.toLowerCase().includes(s) || r.employeeId.toLowerCase().includes(s));
  }
  const enriched = await Promise.all(rows.map(enrichEmployee));
  res.json(enriched);
});

router.post("/employees", requirePermission("employees", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(employeesTable);
  const num = (count[0]?.count ?? 0) + 1;
  const employeeId = `EMP-${String(num).padStart(5, "0")}`;
  const [emp] = await db.insert(employeesTable).values({ ...data, employeeId }).returning();
  res.status(201).json(await enrichEmployee(emp));
});

router.get("/employees/:id", requirePermission("employees", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!emp) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [emp]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(await enrichEmployee(emp));
});

router.put("/employees/:id", requirePermission("employees", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [emp] = await db.update(employeesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(employeesTable.id, id)).returning();
  res.json(await enrichEmployee(emp));
});

// ---- Employee attachments (passport, EID, photo, degree, etc.) ----
async function loadEmployeeForRequest(req: any, res: any, id: number): Promise<typeof employeesTable.$inferSelect | null> {
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!emp) { res.status(404).json({ error: "Employee not found" }); return null; }
  if (!scopeFilter(req, [emp]).length) { res.status(403).json({ error: "Forbidden" }); return null; }
  return emp;
}

router.get("/employees/:id/attachments", requirePermission("employees", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const emp = await loadEmployeeForRequest(req, res, id);
  if (!emp) return;
  const rows = await db.select().from(employeeAttachmentsTable)
    .where(eq(employeeAttachmentsTable.employeeId, id))
    .orderBy(desc(employeeAttachmentsTable.uploadedAt));
  const enriched = await Promise.all(rows.map(async (a) => {
    const signedUrl = await signObjectKey(a.objectKey);
    let uploadedByName: string | undefined;
    if (a.uploadedById) {
      const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, a.uploadedById));
      uploadedByName = u?.name;
    }
    return { ...a, signedUrl, uploadedByName };
  }));
  res.json(enriched);
});

router.post("/employees/:id/attachments", requirePermission("employees", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const emp = await loadEmployeeForRequest(req, res, id);
  if (!emp) return;
  const { category, fileName, objectKey, contentType, sizeBytes, notes } = req.body ?? {};
  if (!category || !fileName || !objectKey) {
    res.status(400).json({ error: "category, fileName and objectKey are required" }); return;
  }
  if (typeof objectKey !== "string" || !objectKey.startsWith("/objects/")) {
    res.status(400).json({ error: "objectKey must reference an uploaded object" }); return;
  }
  const [row] = await db.insert(employeeAttachmentsTable).values({
    employeeId: id,
    category,
    fileName,
    objectKey,
    contentType: contentType ?? null,
    sizeBytes: sizeBytes ?? null,
    notes: notes ?? null,
    uploadedById: req.user?.id ?? null,
  }).returning();
  const signedUrl = await signObjectKey(row.objectKey);
  res.status(201).json({ ...row, signedUrl });
});

router.delete("/employees/:id/attachments/:attachmentId", requirePermission("employees", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const aid = parseInt(Array.isArray(req.params.attachmentId) ? req.params.attachmentId[0] : req.params.attachmentId, 10);
  const emp = await loadEmployeeForRequest(req, res, id);
  if (!emp) return;
  await db.delete(employeeAttachmentsTable)
    .where(and(eq(employeeAttachmentsTable.id, aid), eq(employeeAttachmentsTable.employeeId, id)));
  res.json({ success: true });
});

// Attendance (no companyId column — joins on employee)
router.get("/attendance", requirePermission("attendance", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(attendanceTable).orderBy(sql`${attendanceTable.createdAt} desc`);
  const { employeeId, date, month } = req.query;
  if (employeeId) rows = rows.filter(r => r.employeeId === parseInt(employeeId as string, 10));
  if (date) rows = rows.filter(r => r.date === date);
  if (month) rows = rows.filter(r => r.date.startsWith(month as string));

  const enriched = await Promise.all(rows.map(async (a) => {
    const [emp] = await db.select({ name: employeesTable.name, companyId: employeesTable.companyId }).from(employeesTable).where(eq(employeesTable.id, a.employeeId));
    return { ...a, employeeName: emp?.name, _empCompanyId: emp?.companyId };
  }));
  // Filter by user's company scope using the joined employee.companyId.
  const filtered = enriched.filter(r => {
    if (req.companyScope === null || req.companyScope === undefined) return true;
    return r._empCompanyId == null || req.companyScope.includes(r._empCompanyId);
  }).map(({ _empCompanyId, ...r }) => r);
  // Sign selfie object keys for read access (15-min URLs).
  const withSigned = await Promise.all(filtered.map(enrichRow));
  res.json(withSigned);
});

// ----------------------------------------------------------------------------
// Sales-force GPS + selfie check-in / check-out
// Auto-stamps userId from JWT and companyId from active-company header.
// Selfie is uploaded to object storage first; the client passes selfieObjectKey.
// ----------------------------------------------------------------------------

async function findEmployeeForUser(userId: number, email: string | null | undefined, companyId: number | null) {
  // Prefer email match scoped to active company; fall back to any email match.
  if (email) {
    const lower = email.toLowerCase();
    if (companyId != null) {
      const [byCompany] = await db.select().from(employeesTable)
        .where(and(eq(sql`lower(${employeesTable.email})`, lower), eq(employeesTable.companyId, companyId)));
      if (byCompany) return byCompany;
    }
    const [byEmail] = await db.select().from(employeesTable)
      .where(eq(sql`lower(${employeesTable.email})`, lower));
    if (byEmail) return byEmail;
  }
  return null;
}

router.post("/attendance/check-in", async (req, res): Promise<void> => {
  const u = req.user!;
  const body = req.body ?? {};
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  const accuracy = body.accuracyMeters != null ? Number(body.accuracyMeters) : null;
  const selfieObjectKey: string | undefined = body.selfieObjectKey ?? undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "Invalid GPS coordinates" }); return;
  }
  if (!selfieObjectKey || !selfieObjectKey.startsWith("/objects/")) {
    res.status(400).json({ error: "selfieObjectKey is required" }); return;
  }
  const activeCompanyId = req.companyScope && req.companyScope.length === 1 ? req.companyScope[0] : (u.companyId ?? null);
  const emp = await findEmployeeForUser(u.id, u.email, activeCompanyId);
  if (!emp) {
    res.status(404).json({ error: "No employee record linked to your user. Ask HR to add one with your email." });
    return;
  }
  if (req.companyScope !== null && req.companyScope !== undefined && emp.companyId != null && !req.companyScope.includes(emp.companyId)) {
    res.status(403).json({ error: "Forbidden", message: "Employee outside your company scope" }); return;
  }

  const date = todayKey();
  const now = new Date();

  // If an open entry already exists today, return it instead of duplicating.
  const [open] = await db.select().from(attendanceTable)
    .where(and(eq(attendanceTable.employeeId, emp.id), eq(attendanceTable.date, date)))
    .orderBy(desc(attendanceTable.createdAt));
  if (open && !open.checkOut) {
    const enriched = await enrichRow({ ...open, employeeName: emp.name });
    res.status(200).json(enriched); return;
  }

  const [att] = await db.insert(attendanceTable).values({
    employeeId: emp.id,
    userId: u.id,
    companyId: emp.companyId,
    date,
    checkIn: nowTime(),
    checkInAt: now,
    status: "present",
    latitude: lat,
    longitude: lng,
    accuracyMeters: accuracy ?? undefined,
    selfieObjectKey,
    source: body.source ?? "mobile_gps",
    address: body.address ?? null,
    notes: body.notes ?? null,
  }).returning();

  const enriched = await enrichRow({ ...att, employeeName: emp.name });
  res.status(201).json(enriched);
});

router.post("/attendance/check-out", async (req, res): Promise<void> => {
  const u = req.user!;
  const body = req.body ?? {};
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  const accuracy = body.accuracyMeters != null ? Number(body.accuracyMeters) : null;
  const selfieObjectKey: string | undefined = body.selfieObjectKey ?? undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "Invalid GPS coordinates" }); return;
  }

  const activeCompanyId = req.companyScope && req.companyScope.length === 1 ? req.companyScope[0] : (u.companyId ?? null);
  const emp = await findEmployeeForUser(u.id, u.email, activeCompanyId);
  if (!emp) {
    res.status(404).json({ error: "No employee record linked to your user." }); return;
  }

  const date = todayKey();
  const [open] = await db.select().from(attendanceTable)
    .where(and(eq(attendanceTable.employeeId, emp.id), eq(attendanceTable.date, date)))
    .orderBy(desc(attendanceTable.createdAt));
  if (!open || open.checkOut) {
    res.status(409).json({ error: "No open check-in to close for today." }); return;
  }

  const now = new Date();
  const [att] = await db.update(attendanceTable).set({
    checkOut: nowTime(),
    checkOutAt: now,
    checkOutLatitude: lat,
    checkOutLongitude: lng,
    checkOutAccuracyMeters: accuracy ?? undefined,
    checkOutSelfieObjectKey: selfieObjectKey ?? null,
    notes: body.notes ?? open.notes,
    updatedAt: now,
  }).where(eq(attendanceTable.id, open.id)).returning();

  const enriched = await enrichRow({ ...att, employeeName: emp.name });
  res.status(200).json(enriched);
});

router.post("/attendance", requirePermission("attendance", "create"), async (req, res): Promise<void> => {
  // Verify employee belongs to caller's company scope before recording attendance.
  const empId = req.body?.employeeId;
  if (empId != null) {
    const [emp] = await db.select({ companyId: employeesTable.companyId }).from(employeesTable).where(eq(employeesTable.id, Number(empId)));
    if (!emp) { res.status(404).json({ error: "Employee not found" }); return; }
    if (req.companyScope !== null && req.companyScope !== undefined && emp.companyId != null && !req.companyScope.includes(emp.companyId)) {
      res.status(403).json({ error: "Forbidden", message: "Employee outside your company scope" }); return;
    }
  }
  const [att] = await db.insert(attendanceTable).values(req.body).returning();
  const [emp] = await db.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, att.employeeId));
  res.status(201).json({ ...att, employeeName: emp?.name });
});

router.put("/attendance/:id", requirePermission("attendance", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  // Load the existing row first so we can scope-check via its employee's companyId.
  const [existing] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (req.companyScope !== null && req.companyScope !== undefined) {
    const [emp] = await db.select({ companyId: employeesTable.companyId }).from(employeesTable).where(eq(employeesTable.id, existing.employeeId));
    if (emp?.companyId != null && !req.companyScope.includes(emp.companyId)) {
      res.status(403).json({ error: "Forbidden", message: "Attendance record belongs to an employee outside your company scope" });
      return;
    }
  }
  const [att] = await db.update(attendanceTable).set({ ...req.body, updatedAt: new Date() }).where(eq(attendanceTable.id, id)).returning();
  res.json(att);
});

export default router;
