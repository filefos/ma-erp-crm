import { Router } from "express";
import { db, employeesTable, attendanceTable, departmentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

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
  const enriched = await Promise.all(rows.map(async (e) => {
    let departmentName: string | undefined;
    if (e.departmentId) {
      const [dept] = await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, e.departmentId));
      departmentName = dept?.name;
    }
    return { ...e, departmentName };
  }));
  res.json(enriched);
});

router.post("/employees", requirePermission("employees", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(employeesTable);
  const num = (count[0]?.count ?? 0) + 1;
  const employeeId = `EMP-${String(num).padStart(5, "0")}`;
  const [emp] = await db.insert(employeesTable).values({ ...data, employeeId }).returning();
  res.status(201).json(emp);
});

router.get("/employees/:id", requirePermission("employees", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!emp) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [emp]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(emp);
});

router.put("/employees/:id", requirePermission("employees", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [emp] = await db.update(employeesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(employeesTable.id, id)).returning();
  res.json(emp);
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
  res.json(filtered);
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
