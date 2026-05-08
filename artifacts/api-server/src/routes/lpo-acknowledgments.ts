import { Router } from "express";
import { db, lpoAcknowledgmentsTable } from "@workspace/db";
import { eq, and, or, ilike, inArray } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

// List all LPO acknowledgments (company-scoped)
router.get("/lpo-acknowledgments", requirePermission("lpos", "view"), async (req, res): Promise<void> => {
  let rows = await db
    .select({
      id: lpoAcknowledgmentsTable.id,
      companyId: lpoAcknowledgmentsTable.companyId,
      customerName: lpoAcknowledgmentsTable.customerName,
      customerId: lpoAcknowledgmentsTable.customerId,
      quotationNumber: lpoAcknowledgmentsTable.quotationNumber,
      lpoNumber: lpoAcknowledgmentsTable.lpoNumber,
      fileName: lpoAcknowledgmentsTable.fileName,
      contentType: lpoAcknowledgmentsTable.contentType,
      fileSize: lpoAcknowledgmentsTable.fileSize,
      uploadDate: lpoAcknowledgmentsTable.uploadDate,
      remarks: lpoAcknowledgmentsTable.remarks,
      uploadedByName: lpoAcknowledgmentsTable.uploadedByName,
      createdAt: lpoAcknowledgmentsTable.createdAt,
      updatedAt: lpoAcknowledgmentsTable.updatedAt,
    })
    .from(lpoAcknowledgmentsTable)
    .orderBy(lpoAcknowledgmentsTable.createdAt);

  rows = scopeFilter(req, rows) as typeof rows;

  const { search, companyId } = req.query;
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (search) {
    const s = (search as string).toLowerCase();
    rows = rows.filter(r =>
      r.customerName?.toLowerCase().includes(s) ||
      r.lpoNumber?.toLowerCase().includes(s) ||
      r.quotationNumber?.toLowerCase().includes(s)
    );
  }

  res.json(rows);
});

// Get single acknowledgment (without file content — metadata only)
router.get("/lpo-acknowledgments/:id", requirePermission("lpos", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [row] = await db
    .select({
      id: lpoAcknowledgmentsTable.id,
      companyId: lpoAcknowledgmentsTable.companyId,
      customerName: lpoAcknowledgmentsTable.customerName,
      customerId: lpoAcknowledgmentsTable.customerId,
      quotationNumber: lpoAcknowledgmentsTable.quotationNumber,
      lpoNumber: lpoAcknowledgmentsTable.lpoNumber,
      fileName: lpoAcknowledgmentsTable.fileName,
      contentType: lpoAcknowledgmentsTable.contentType,
      fileSize: lpoAcknowledgmentsTable.fileSize,
      uploadDate: lpoAcknowledgmentsTable.uploadDate,
      remarks: lpoAcknowledgmentsTable.remarks,
      uploadedByName: lpoAcknowledgmentsTable.uploadedByName,
      createdAt: lpoAcknowledgmentsTable.createdAt,
    })
    .from(lpoAcknowledgmentsTable)
    .where(eq(lpoAcknowledgmentsTable.id, id));

  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  const scope = req.companyScope;
  if (scope !== null && scope !== undefined && !scope.includes(row.companyId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  res.json(row);
});

// Serve the raw PDF file inline (for preview / download)
router.get("/lpo-acknowledgments/:id/file", requirePermission("lpos", "view"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [row] = await db
    .select()
    .from(lpoAcknowledgmentsTable)
    .where(eq(lpoAcknowledgmentsTable.id, id));

  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  const scope = req.companyScope;
  if (scope !== null && scope !== undefined && !scope.includes(row.companyId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const buffer = Buffer.from(row.fileContent, "base64");
  const disposition = req.query.download === "1" ? "attachment" : "inline";
  res.setHeader("Content-Type", row.contentType ?? "application/pdf");
  res.setHeader("Content-Disposition", `${disposition}; filename="${row.fileName}"`);
  res.setHeader("Content-Length", buffer.length);
  res.send(buffer);
});

// Create / upload new acknowledgment
router.post("/lpo-acknowledgments", requirePermission("lpos", "create"), async (req, res): Promise<void> => {
  const scope = req.companyScope;
  const companyId = parseInt(req.body.companyId, 10);
  if (scope !== null && scope !== undefined && !scope.includes(companyId)) {
    res.status(403).json({ error: "companyId not in your scope" }); return;
  }
  if (!req.body.fileContent) { res.status(400).json({ error: "fileContent is required" }); return; }
  if (!req.body.customerName) { res.status(400).json({ error: "customerName is required" }); return; }

  const [row] = await db.insert(lpoAcknowledgmentsTable).values({
    companyId,
    customerName: req.body.customerName,
    customerId: req.body.customerId ? parseInt(req.body.customerId, 10) : null,
    quotationNumber: req.body.quotationNumber ?? null,
    lpoNumber: req.body.lpoNumber ?? null,
    fileName: req.body.fileName ?? "lpo-acknowledgment.pdf",
    contentType: req.body.contentType ?? "application/pdf",
    fileContent: req.body.fileContent,
    fileSize: req.body.fileSize ?? null,
    uploadDate: req.body.uploadDate ?? new Date().toISOString().slice(0, 10),
    remarks: req.body.remarks ?? null,
    uploadedById: req.user?.id ?? null,
    uploadedByName: req.user?.name ?? null,
  }).returning();

  res.status(201).json(row);
});

// Replace PDF + update fields
router.put("/lpo-acknowledgments/:id", requirePermission("lpos", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select({ companyId: lpoAcknowledgmentsTable.companyId })
    .from(lpoAcknowledgmentsTable).where(eq(lpoAcknowledgmentsTable.id, id));

  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const scope = req.companyScope;
  if (scope !== null && scope !== undefined && !scope.includes(existing.companyId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const updates: Record<string, any> = {
    updatedAt: new Date(),
  };
  if (req.body.customerName !== undefined) updates.customerName = req.body.customerName;
  if (req.body.quotationNumber !== undefined) updates.quotationNumber = req.body.quotationNumber;
  if (req.body.lpoNumber !== undefined) updates.lpoNumber = req.body.lpoNumber;
  if (req.body.remarks !== undefined) updates.remarks = req.body.remarks;
  if (req.body.uploadDate !== undefined) updates.uploadDate = req.body.uploadDate;
  if (req.body.fileContent !== undefined) {
    updates.fileContent = req.body.fileContent;
    updates.fileName = req.body.fileName ?? "lpo-acknowledgment.pdf";
    updates.contentType = req.body.contentType ?? "application/pdf";
    updates.fileSize = req.body.fileSize ?? null;
  }

  const [row] = await db.update(lpoAcknowledgmentsTable).set(updates)
    .where(eq(lpoAcknowledgmentsTable.id, id)).returning();

  res.json(row);
});

// Delete acknowledgment
router.delete("/lpo-acknowledgments/:id", requirePermission("lpos", "delete"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select({ companyId: lpoAcknowledgmentsTable.companyId })
    .from(lpoAcknowledgmentsTable).where(eq(lpoAcknowledgmentsTable.id, id));

  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const scope = req.companyScope;
  if (scope !== null && scope !== undefined && !scope.includes(existing.companyId)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(lpoAcknowledgmentsTable).where(eq(lpoAcknowledgmentsTable.id, id));
  res.json({ success: true });
});

export default router;
