import { Router } from "express";
import { db, departmentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/departments", async (_req, res): Promise<void> => {
  const depts = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  res.json(depts);
});

router.post("/departments", async (req, res): Promise<void> => {
  const { name, description } = req.body;
  const [dept] = await db.insert(departmentsTable).values({ name, description }).returning();
  res.status(201).json(dept);
});

export default router;
