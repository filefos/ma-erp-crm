import { Router } from "express";
import { db, employeesTable, attendanceTable, departmentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

// Employees
router.get("/employees", async (req, res): Promise<void> => {
  let rows = await db.select().from(employeesTable).orderBy(employeesTable.name);
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

router.post("/employees", async (req, res): Promise<void> => {
  const data = req.body;
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(employeesTable);
  const num = (count[0]?.count ?? 0) + 1;
  const employeeId = `EMP-${String(num).padStart(5, "0")}`;
  const [emp] = await db.insert(employeesTable).values({ ...data, employeeId }).returning();
  res.status(201).json(emp);
});

router.get("/employees/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!emp) { res.status(404).json({ error: "Not found" }); return; }
  res.json(emp);
});

router.put("/employees/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [emp] = await db.update(employeesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(employeesTable.id, id)).returning();
  if (!emp) { res.status(404).json({ error: "Not found" }); return; }
  res.json(emp);
});

// Attendance
router.get("/attendance", async (req, res): Promise<void> => {
  let rows = await db.select().from(attendanceTable).orderBy(sql`${attendanceTable.createdAt} desc`);
  const { employeeId, date, month, companyId } = req.query;
  if (employeeId) rows = rows.filter(r => r.employeeId === parseInt(employeeId as string, 10));
  if (date) rows = rows.filter(r => r.date === date);
  if (month) rows = rows.filter(r => r.date.startsWith(month as string));
  
  const enriched = await Promise.all(rows.map(async (a) => {
    const [emp] = await db.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, a.employeeId));
    return { ...a, employeeName: emp?.name };
  }));
  res.json(enriched);
});

router.post("/attendance", async (req, res): Promise<void> => {
  const [att] = await db.insert(attendanceTable).values(req.body).returning();
  const [emp] = await db.select({ name: employeesTable.name }).from(employeesTable).where(eq(employeesTable.id, att.employeeId));
  res.status(201).json({ ...att, employeeName: emp?.name });
});

router.put("/attendance/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [att] = await db.update(attendanceTable).set({ ...req.body, updatedAt: new Date() }).where(eq(attendanceTable.id, id)).returning();
  if (!att) { res.status(404).json({ error: "Not found" }); return; }
  res.json(att);
});

export default router;
