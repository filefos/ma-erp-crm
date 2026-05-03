import { Router } from "express";
import { db, employeesTable, attendanceTable, companiesTable } from "@workspace/db";
import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

// Round to 2 decimal places — payroll figures are AED so cents matter.
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Parse `YYYY-MM` to `{ start, end, daysInMonth }`. Defaults to the current
// month when omitted/invalid so the UI never has to special-case empty input.
function monthBounds(input: string | undefined | null): { month: string; start: string; end: string; daysInMonth: number } {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    const [y, m] = input.split("-").map((s) => parseInt(s, 10));
    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) {
      year = y;
      month = m;
    }
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  const dd = String(daysInMonth).padStart(2, "0");
  return {
    month: `${year}-${mm}`,
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${dd}`,
    daysInMonth,
  };
}

// GET /payroll?month=YYYY-MM&companyId=N
//
// Returns one row per active employee with their monthly pay computed from
// attendance: dailyWage = (basic + allowances) / 30, gross = present * dailyWage,
// unauthorisedDeduction = unauthorisedAbsent * 3 * dailyWage (per the company
// rule baked into every offer letter), net = max(0, gross - unauthorisedDeduction).
router.get("/payroll", requirePermission("payroll", "view"), async (req, res): Promise<void> => {
  const bounds = monthBounds(typeof req.query.month === "string" ? req.query.month : undefined);
  const companyIdQ = req.query.companyId;
  const companyIdFilter = typeof companyIdQ === "string" && /^\d+$/.test(companyIdQ) ? parseInt(companyIdQ, 10) : undefined;

  // Active employees (scope-filtered to the user's accessible companies).
  let employees = await db.select().from(employeesTable).where(eq(employeesTable.isActive, true));
  employees = scopeFilter(req, employees);
  if (companyIdFilter) employees = employees.filter((e) => e.companyId === companyIdFilter);

  // Lookup company names once.
  const companyIds = Array.from(new Set(employees.map((e) => e.companyId)));
  const companies = companyIds.length
    ? await db.select({ id: companiesTable.id, name: companiesTable.name }).from(companiesTable).where(inArray(companiesTable.id, companyIds))
    : [];
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  // Load all attendance rows for these employees in the month — single query.
  const empIds = employees.map((e) => e.id);
  const attRows = empIds.length
    ? await db.select().from(attendanceTable).where(and(
        inArray(attendanceTable.employeeId, empIds),
        gte(attendanceTable.date, bounds.start),
        lte(attendanceTable.date, bounds.end),
      ))
    : [];

  // Bucket attendance by employee → date so multiple punches on the same day
  // collapse into a single status (latest wins). This matches how check-in /
  // check-out endpoints already work.
  const byEmpDay = new Map<number, Map<string, { status: string; notes: string | null }>>();
  for (const a of attRows) {
    let m = byEmpDay.get(a.employeeId);
    if (!m) { m = new Map(); byEmpDay.set(a.employeeId, m); }
    m.set(a.date, { status: (a.status ?? "present").toLowerCase(), notes: a.notes ?? null });
  }

  const rows = employees.map((e) => {
    const basic = e.basicSalary ?? 0;
    const allow = e.allowances ?? 0;
    const monthlySalary = basic + allow;
    const dailyWage = monthlySalary / 30;

    const days = byEmpDay.get(e.id);
    let presentDays = 0;
    let absentDays = 0;
    let unauthorisedDays = 0;
    if (days) {
      for (const d of days.values()) {
        if (d.status === "present" || d.status === "late") {
          presentDays += 1;
        } else if (d.status === "absent") {
          absentDays += 1;
          // "Without solid reason" = no notes recorded for that absence.
          if (!d.notes || !d.notes.trim()) unauthorisedDays += 1;
        }
        // Other statuses (leave, holiday, sick) are neither paid nor penalised.
      }
    }
    const grossPay = presentDays * dailyWage;
    const unauthorisedDeduction = unauthorisedDays * 3 * dailyWage;
    const netPay = Math.max(0, grossPay - unauthorisedDeduction);

    return {
      employeeId: e.id,
      employeeCode: e.employeeId,
      employeeName: e.name,
      designation: e.designation ?? null,
      companyId: e.companyId,
      companyName: companyName.get(e.companyId) ?? null,
      basicSalary: r2(basic),
      allowances: r2(allow),
      monthlySalary: r2(monthlySalary),
      dailyWage: r2(dailyWage),
      daysInMonth: bounds.daysInMonth,
      presentDays,
      absentDays,
      unauthorisedDays,
      grossPay: r2(grossPay),
      unauthorisedDeduction: r2(unauthorisedDeduction),
      netPay: r2(netPay),
    };
  });

  res.json({ month: bounds.month, daysInMonth: bounds.daysInMonth, rows });
});

export default router;
