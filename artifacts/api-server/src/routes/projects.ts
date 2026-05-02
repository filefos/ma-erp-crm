import { Router } from "express";
import { db, projectsTable, companiesTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

async function enrichProject(p: typeof projectsTable.$inferSelect) {
  let companyRef: string | undefined;
  let projectManagerName: string | undefined;
  if (p.companyId) {
    const [co] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, p.companyId));
    companyRef = co?.name;
  }
  if (p.projectManagerId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, p.projectManagerId));
    projectManagerName = u?.name;
  }
  return { ...p, companyRef, projectManagerName };
}

router.get("/projects", requirePermission("projects", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(projectsTable).orderBy(sql`${projectsTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const { stage, companyId, search } = req.query;
  if (stage) rows = rows.filter(r => r.stage === stage);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (search) {
    const s = (search as string).toLowerCase();
    rows = rows.filter(r => r.projectName.toLowerCase().includes(s) || r.clientName.toLowerCase().includes(s));
  }
  res.json(await Promise.all(rows.map(enrichProject)));
});

router.post("/projects", requirePermission("projects", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const data = req.body;
  const [co] = data.companyId ? await db.select({ prefix: companiesTable.prefix }).from(companiesTable).where(eq(companiesTable.id, data.companyId)) : [{ prefix: "PM" }];
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(projectsTable);
  const num = (count[0]?.count ?? 0) + 1;
  const projectNumber = `${co?.prefix ?? "PM"}-PRJ-${new Date().getFullYear()}-${String(num).padStart(4, "0")}`;
  const [project] = await db.insert(projectsTable).values({ ...data, projectNumber }).returning();
  res.status(201).json(await enrichProject(project));
});

router.get("/projects/:id", requirePermission("projects", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [project]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(await enrichProject(project));
});

router.put("/projects/:id", requirePermission("projects", "edit"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const [project] = await db.update(projectsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(projectsTable.id, id)).returning();
  res.json(await enrichProject(project));
});

export default router;
