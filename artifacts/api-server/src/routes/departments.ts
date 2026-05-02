import { Router } from "express";
import { db, departmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requirePermissionLevel } from "../middlewares/auth";
import { audit } from "../lib/audit";
import { validateBody } from "../middlewares/validate";
import { CreateDepartmentBody, UpdateDepartmentBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

router.get("/departments", async (req, res): Promise<void> => {
  const depts = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  // Description field is admin-only — all other users see only id, name, isActive.
  const lvl = req.user?.permissionLevel ?? "user";
  if (lvl === "super_admin" || lvl === "company_admin") { res.json(depts); return; }
  res.json(depts.map(d => ({ id: d.id, name: d.name, isActive: d.isActive, description: null, createdAt: d.createdAt })));
});

router.post("/departments", requirePermissionLevel("super_admin"), validateBody(CreateDepartmentBody), async (req, res): Promise<void> => {
  const { name, description } = req.body;
  const [dept] = await db.insert(departmentsTable).values({ name, description }).returning();
  await audit(req, { action: "create", entity: "department", entityId: dept.id, details: `Created department ${dept.name}` });
  res.status(201).json(dept);
});

router.put("/departments/:id", requirePermissionLevel("super_admin"), validateBody(UpdateDepartmentBody), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, description, isActive } = req.body;
  const [dept] = await db.update(departmentsTable).set({
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(isActive !== undefined && { isActive }),
  }).where(eq(departmentsTable.id, id)).returning();
  if (!dept) { res.status(404).json({ error: "Not found" }); return; }
  await audit(req, { action: "update", entity: "department", entityId: id, details: `Updated department ${dept.name}` });
  res.json(dept);
});

export default router;
