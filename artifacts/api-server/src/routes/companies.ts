import { Router } from "express";
import { db, companiesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth, requirePermissionLevel, isAdmin, inScope } from "../middlewares/auth";
import { audit } from "../lib/audit";
import { validateBody } from "../middlewares/validate";
import { CreateCompanyBody, UpdateCompanyBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

// Field-level filtering: non-admins receive only id/name/shortName/prefix/vatPercent/logo/isActive.
// Sensitive fields (trn, bankDetails, letterhead, address, phone, email) require admin.
function publicCompanyFields<T extends { id: number; name: string; shortName: string | null; prefix: string | null; vatPercent: number | null; logo: string | null; isActive: boolean }>(c: T) {
  return { id: c.id, name: c.name, shortName: c.shortName, prefix: c.prefix, vatPercent: c.vatPercent, logo: c.logo, isActive: c.isActive };
}

router.get("/companies", async (req, res): Promise<void> => {
  // Tenant isolation: non-super_admin users only see companies in their scope.
  const scope = req.companyScope;
  let companies: (typeof companiesTable.$inferSelect)[];
  if (scope === null || scope === undefined) {
    companies = await db.select().from(companiesTable).orderBy(companiesTable.id);
  } else if (scope.length === 0) {
    companies = [];
  } else {
    companies = await db.select().from(companiesTable).where(inArray(companiesTable.id, scope)).orderBy(companiesTable.id);
  }
  if (isAdmin(req.user)) { res.json(companies); return; }
  res.json(companies.map(publicCompanyFields));
});

router.post("/companies", requirePermissionLevel("super_admin"), validateBody(CreateCompanyBody), async (req, res): Promise<void> => {
  const data = req.body;
  const [co] = await db.insert(companiesTable).values({
    name: data.name,
    shortName: data.shortName,
    prefix: data.prefix,
    address: data.address,
    phone: data.phone,
    email: data.email,
    website: data.website,
    trn: data.trn,
    vatPercent: data.vatPercent ?? 5,
    logo: data.logo,
    bankDetails: data.bankDetails,
    letterhead: data.letterhead,
  }).returning();
  await audit(req, { action: "create", entity: "company", entityId: co.id, details: `Created company ${co.name}` });
  res.status(201).json(co);
});

router.get("/companies/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (!inScope(req, id)) {
    res.status(403).json({ error: "Forbidden", message: "Company is outside your scope" });
    return;
  }
  const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!co) { res.status(404).json({ error: "Not found" }); return; }
  if (isAdmin(req.user)) { res.json(co); return; }
  res.json(publicCompanyFields(co));
});

router.put("/companies/:id", requirePermissionLevel("company_admin"), validateBody(UpdateCompanyBody), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  // Tenant isolation: company_admin may only edit companies in their scope; super_admin bypasses.
  if (!inScope(req, id)) {
    res.status(403).json({ error: "Forbidden", message: "Cannot edit a company outside your scope" });
    return;
  }
  const data = req.body;
  const [co] = await db.update(companiesTable).set({ ...data, updatedAt: new Date() }).where(eq(companiesTable.id, id)).returning();
  if (!co) { res.status(404).json({ error: "Not found" }); return; }
  await audit(req, { action: "update", entity: "company", entityId: id, details: `Updated company ${co.name}` });
  res.json(co);
});

export default router;
