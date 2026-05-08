import { Router } from "express";
import { db, companyDocumentsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg", "image/jpg", "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function isAdmin(req: any): boolean {
  return req.user?.role === "super_admin" || req.user?.role === "company_admin";
}

function scopedCompanyIds(req: any): number[] | null {
  const scope = req.companyScope as number[] | null | undefined;
  if (scope === null || scope === undefined) return null; // super_admin: all
  return scope;
}

// GET /company-documents?companyId=&category=&status=active
router.get("/company-documents", async (req, res): Promise<void> => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin only" }); return; }

  const allowed = scopedCompanyIds(req);
  const { companyId, category, status } = req.query;

  let rows = await db
    .select({
      id: companyDocumentsTable.id,
      companyId: companyDocumentsTable.companyId,
      category: companyDocumentsTable.category,
      customName: companyDocumentsTable.customName,
      fileName: companyDocumentsTable.fileName,
      contentType: companyDocumentsTable.contentType,
      fileSize: companyDocumentsTable.fileSize,
      revisionNumber: companyDocumentsTable.revisionNumber,
      status: companyDocumentsTable.status,
      remarks: companyDocumentsTable.remarks,
      uploadedByName: companyDocumentsTable.uploadedByName,
      uploadDate: companyDocumentsTable.uploadDate,
      createdAt: companyDocumentsTable.createdAt,
    })
    .from(companyDocumentsTable)
    .orderBy(companyDocumentsTable.category, companyDocumentsTable.revisionNumber);

  if (allowed !== null) rows = rows.filter(r => allowed.includes(r.companyId));
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (category) rows = rows.filter(r => r.category === category);
  if (status) rows = rows.filter(r => r.status === status);
  else rows = rows.filter(r => r.status === "active");

  res.json(rows);
});

// GET /company-documents/:id/file — serve raw file
router.get("/company-documents/:id/file", async (req, res): Promise<void> => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin only" }); return; }
  const id = parseInt(req.params.id, 10);
  const [row] = await db.select().from(companyDocumentsTable).where(eq(companyDocumentsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  const allowed = scopedCompanyIds(req);
  if (allowed !== null && !allowed.includes(row.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }

  const buffer = Buffer.from(row.fileContent, "base64");
  const disposition = req.query.download === "1" ? "attachment" : "inline";
  res.setHeader("Content-Type", row.contentType);
  res.setHeader("Content-Disposition", `${disposition}; filename="${row.fileName}"`);
  res.setHeader("Content-Length", buffer.length);
  res.send(buffer);
});

// POST /company-documents — upload new document
router.post("/company-documents", async (req, res): Promise<void> => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin only" }); return; }

  const { companyId, category, customName, fileName, contentType, fileContent, fileSize, remarks } = req.body;
  if (!companyId) { res.status(400).json({ error: "companyId required" }); return; }
  if (!category) { res.status(400).json({ error: "category required" }); return; }
  if (!fileContent) { res.status(400).json({ error: "fileContent required" }); return; }

  const allowed = scopedCompanyIds(req);
  if (allowed !== null && !allowed.includes(parseInt(companyId, 10))) {
    res.status(403).json({ error: "companyId not in scope" }); return;
  }

  const [row] = await db.insert(companyDocumentsTable).values({
    companyId: parseInt(companyId, 10),
    category,
    customName: customName || null,
    fileName: fileName || "document",
    contentType: contentType || "application/octet-stream",
    fileContent,
    fileSize: fileSize || null,
    revisionNumber: 0,
    status: "active",
    remarks: remarks || null,
    uploadedById: req.user?.id ?? null,
    uploadedByName: req.user?.name ?? null,
    uploadDate: new Date().toISOString().slice(0, 10),
  }).returning();

  res.status(201).json(row);
});

// PUT /company-documents/:id/replace — replace or revise
// body: { keepPrevious: boolean, fileContent, fileName, contentType, fileSize, remarks }
router.put("/company-documents/:id/replace", async (req, res): Promise<void> => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin only" }); return; }

  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(companyDocumentsTable).where(eq(companyDocumentsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const allowed = scopedCompanyIds(req);
  if (allowed !== null && !allowed.includes(existing.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }

  const { keepPrevious, fileContent, fileName, contentType, fileSize, remarks } = req.body;
  if (!fileContent) { res.status(400).json({ error: "fileContent required" }); return; }

  const newRevision = (existing.revisionNumber ?? 0) + 1;

  if (!keepPrevious) {
    // Archive the old record, insert fresh with revision 0
    await db.update(companyDocumentsTable)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(companyDocumentsTable.id, id));
  }
  // In both cases create new record: revision increments if keeping, resets if replacing
  const [newRow] = await db.insert(companyDocumentsTable).values({
    companyId: existing.companyId,
    category: existing.category,
    customName: existing.customName,
    fileName: fileName || existing.fileName,
    contentType: contentType || existing.contentType,
    fileContent,
    fileSize: fileSize || null,
    revisionNumber: keepPrevious ? newRevision : 0,
    status: "active",
    remarks: remarks ?? existing.remarks,
    uploadedById: req.user?.id ?? null,
    uploadedByName: req.user?.name ?? null,
    uploadDate: new Date().toISOString().slice(0, 10),
  }).returning();

  res.json({ newDocument: newRow, archivedPrevious: !keepPrevious });
});

// PATCH /company-documents/:id — update remarks only
router.patch("/company-documents/:id", async (req, res): Promise<void> => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin only" }); return; }

  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select({ companyId: companyDocumentsTable.companyId })
    .from(companyDocumentsTable).where(eq(companyDocumentsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const allowed = scopedCompanyIds(req);
  if (allowed !== null && !allowed.includes(existing.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (req.body.remarks !== undefined) updates.remarks = req.body.remarks;
  if (req.body.customName !== undefined) updates.customName = req.body.customName;

  const [row] = await db.update(companyDocumentsTable).set(updates)
    .where(eq(companyDocumentsTable.id, id)).returning();
  res.json(row);
});

// DELETE /company-documents/:id
router.delete("/company-documents/:id", async (req, res): Promise<void> => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Admin only" }); return; }

  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select({ companyId: companyDocumentsTable.companyId })
    .from(companyDocumentsTable).where(eq(companyDocumentsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const allowed = scopedCompanyIds(req);
  if (allowed !== null && !allowed.includes(existing.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(companyDocumentsTable).where(eq(companyDocumentsTable.id, id));
  res.json({ success: true });
});

export default router;
