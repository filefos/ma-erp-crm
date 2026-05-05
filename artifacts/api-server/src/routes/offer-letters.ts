import { Router } from "express";
import {
  db, offerLettersTable, offerLetterAttachmentsTable,
  employeesTable, companiesTable, usersTable,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission, scopeFilter, requireBodyCompanyAccess } from "../middlewares/auth";
import { ObjectStorageService } from "../lib/objectStorage";

const storageService = new ObjectStorageService();
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

const router = Router();
router.use(requireAuth);

async function enrichOffer(o: typeof offerLettersTable.$inferSelect): Promise<any> {
  let companyName: string | undefined;
  let createdByName: string | undefined;
  if (o.companyId) {
    const [c] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, o.companyId));
    companyName = c?.name;
  }
  if (o.createdById) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, o.createdById));
    createdByName = u?.name;
  }
  return { ...o, companyName, createdByName };
}

// Brand prefixes for the customer-facing reference number — `PMOL-` for
// Prime Max, `EOL-` for Elite, `OL-` as a defensive fallback for any
// company that doesn't match either brand. Per-brand sequences keep the
// counters independent so each company gets its own monotonic numbering.
function brandPrefix(brand: string | null): { prefix: string; seq: string } {
  if (brand === "prime") return { prefix: "PMOL", seq: "offer_letter_number_seq_prime" };
  if (brand === "elite") return { prefix: "EOL",  seq: "offer_letter_number_seq_elite" };
  return { prefix: "OL", seq: "offer_letter_number_seq" };
}

async function nextLetterNumber(brand: string | null): Promise<string> {
  const year = new Date().getFullYear();
  const { prefix, seq } = brandPrefix(brand);
  // Use a Postgres sequence so concurrent INSERTs cannot collide on the unique
  // letter_number constraint. Sequence is monotonic across years; the year
  // prefix is informational, not a per-year counter.
  const result: any = await db.execute(sql.raw(`SELECT nextval('${seq}') AS n`));
  const n = Number(result.rows?.[0]?.n ?? result[0]?.n ?? 1);
  return `${prefix}-${year}-${String(n).padStart(4, "0")}`;
}

async function snapshotLetterhead(companyId: number): Promise<{ letterheadBrand: string | null; companyLegalName: string | null }> {
  const [c] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
  if (!c) return { letterheadBrand: null, companyLegalName: null };
  const blob = `${(c as any).shortName ?? ""} ${c.name ?? ""}`.toLowerCase();
  const brand = blob.includes("elite") ? "elite" : blob.includes("prime") ? "prime" : null;
  return { letterheadBrand: brand, companyLegalName: c.name ?? null };
}

// LIST
router.get("/offer-letters", requirePermission("offer_letters", "view"), async (req, res): Promise<void> => {
  let rows = await db.select().from(offerLettersTable).orderBy(desc(offerLettersTable.createdAt));
  rows = scopeFilter(req, rows);
  const { status, companyId, templateType, employeeId } = req.query;
  if (status) rows = rows.filter(r => r.status === status);
  if (companyId) rows = rows.filter(r => r.companyId === parseInt(companyId as string, 10));
  if (templateType) rows = rows.filter(r => r.templateType === templateType);
  if (employeeId) rows = rows.filter(r => r.employeeId === parseInt(employeeId as string, 10));
  const enriched = await Promise.all(rows.map(enrichOffer));
  res.json(enriched);
});

// GET ONE
router.get("/offer-letters/:id", requirePermission("offer_letters", "view"), async (req, res): Promise<void> => {
  const id = parseInt(String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id), 10);
  const [row] = await db.select().from(offerLettersTable).where(eq(offerLettersTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [row]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(await enrichOffer(row));
});

// CREATE
router.post("/offer-letters", requirePermission("offer_letters", "create"), requireBodyCompanyAccess(), async (req, res): Promise<void> => {
  const body = req.body ?? {};
  if (!body.companyId || !body.templateType || !body.candidateName) {
    res.status(400).json({ error: "companyId, templateType and candidateName are required" }); return;
  }
  const snap = await snapshotLetterhead(body.companyId);
  const letterNumber = await nextLetterNumber(snap.letterheadBrand);
  const [row] = await db.insert(offerLettersTable).values({
    ...body,
    letterNumber,
    status: "draft",
    version: 1,
    letterheadBrand: snap.letterheadBrand,
    companyLegalName: snap.companyLegalName,
    createdById: req.user?.id ?? null,
  }).returning();
  res.status(201).json(await enrichOffer(row));
});

// UPDATE — allowed in any status until the offer has been converted to an
// employee record. HR needs to be able to fix typos / correct salary lines on
// already-issued letters without going through a full re-issue cycle.
router.put("/offer-letters/:id", requirePermission("offer_letters", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id), 10);
  const [existing] = await db.select().from(offerLettersTable).where(eq(offerLettersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  if (existing.convertedEmployeeId) {
    res.status(409).json({ error: "This offer has already been converted to an employee and is locked. Edit the employee record instead." }); return;
  }
  const body = req.body ?? {};
  // Prevent clobbering of immutable fields (incl. companyId — would let a user
  // move a draft into a company they have access to, then back, breaking scope).
  delete body.letterNumber; delete body.status; delete body.version; delete body.parentOfferId;
  delete body.issuedAt; delete body.acceptedAt; delete body.rejectedAt;
  delete body.convertedEmployeeId; delete body.convertedAt; delete body.createdById;
  delete body.companyId; delete body.id; delete body.employeeId;
  const [row] = await db.update(offerLettersTable).set({ ...body, updatedAt: new Date() }).where(eq(offerLettersTable.id, id)).returning();
  res.json(await enrichOffer(row));
});

// STATUS TRANSITION
router.post("/offer-letters/:id/status", requirePermission("offer_letters", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id), 10);
  const [existing] = await db.select().from(offerLettersTable).where(eq(offerLettersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [existing]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  const status: string = req.body?.status;
  const allowed: Record<string, string[]> = {
    draft: ["issued"],
    issued: ["accepted", "rejected"],
    accepted: [],
    rejected: [],
  };
  if (!status || !allowed[existing.status]?.includes(status)) {
    res.status(400).json({ error: `Cannot transition ${existing.status} → ${status ?? "?"}` }); return;
  }
  const now = new Date();
  const patch: Record<string, unknown> = { status, updatedAt: now };
  if (status === "issued") patch.issuedAt = now;
  if (status === "accepted") patch.acceptedAt = now;
  if (status === "rejected") {
    patch.rejectedAt = now;
    patch.rejectionReason = req.body?.rejectionReason ?? null;
  }
  const [row] = await db.update(offerLettersTable).set(patch).where(eq(offerLettersTable.id, id)).returning();
  res.json(await enrichOffer(row));
});

// REISSUE — clones the letter as a new draft, version+1, parent_offer_id=this
router.post("/offer-letters/:id/reissue", requirePermission("offer_letters", "create"), async (req, res): Promise<void> => {
  const id = parseInt(String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id), 10);
  const [src] = await db.select().from(offerLettersTable).where(eq(offerLettersTable.id, id));
  if (!src) { res.status(404).json({ error: "Not found" }); return; }
  if (!scopeFilter(req, [src]).length) { res.status(403).json({ error: "Forbidden" }); return; }
  // Re-snapshot the letterhead at re-issue time so a renamed/rebranded company
  // produces an updated, deterministic snapshot for the new draft.
  const snap = await snapshotLetterhead(src.companyId);
  const letterNumber = await nextLetterNumber(snap.letterheadBrand);
  const [row] = await db.insert(offerLettersTable).values({
    letterNumber,
    companyId: src.companyId,
    templateType: src.templateType,
    status: "draft",
    employeeId: src.employeeId,
    candidateName: src.candidateName,
    candidateNationality: src.candidateNationality,
    candidatePassportNo: src.candidatePassportNo,
    candidatePersonalEmail: src.candidatePersonalEmail,
    candidatePersonalPhone: src.candidatePersonalPhone,
    designation: src.designation,
    joiningDate: src.joiningDate,
    basicSalary: src.basicSalary,
    allowances: src.allowances,
    workerType: src.workerType,
    notes: src.notes,
    commissionEnabled: src.commissionEnabled,
    commissionTargetAmount: src.commissionTargetAmount,
    commissionCurrency: src.commissionCurrency,
    commissionBaseRatePct: src.commissionBaseRatePct,
    commissionBonusPerStepAmount: src.commissionBonusPerStepAmount,
    commissionBonusStepSize: src.commissionBonusStepSize,
    commissionShortfallTier1Pct: src.commissionShortfallTier1Pct,
    commissionShortfallTier1DeductionPct: src.commissionShortfallTier1DeductionPct,
    commissionShortfallTier2Pct: src.commissionShortfallTier2Pct,
    commissionShortfallTier2DeductionPct: src.commissionShortfallTier2DeductionPct,
    commissionNotes: src.commissionNotes,
    parentOfferId: src.id,
    version: src.version + 1,
    letterheadBrand: snap.letterheadBrand,
    companyLegalName: snap.companyLegalName,
    createdById: req.user?.id ?? null,
  }).returning();
  res.status(201).json(await enrichOffer(row));
});

// CONVERT TO EMPLOYEE — creates an employees row from the accepted offer
// Wrapped in a transaction with row-level lock for idempotency under concurrency.
router.post("/offer-letters/:id/convert-to-employee", requirePermission("offer_letters", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id), 10);
  try {
    const result = await db.transaction(async (tx) => {
      const locked = await tx.execute(sql`SELECT * FROM offer_letters WHERE id = ${id} FOR UPDATE`);
      const offer = (locked.rows?.[0] ?? (locked as any)[0]) as any;
      if (!offer) return { status: 404 as const, body: { error: "Not found" } };
      if (!scopeFilter(req, [{ companyId: offer.company_id ?? offer.companyId } as any]).length) {
        return { status: 403 as const, body: { error: "Forbidden" } };
      }
      if (offer.status !== "accepted") {
        return { status: 409 as const, body: { error: "Only accepted offer letters can be converted to employees." } };
      }
      const existingEmpId = offer.converted_employee_id ?? offer.convertedEmployeeId;
      if (existingEmpId) {
        const [emp] = await tx.select().from(employeesTable).where(eq(employeesTable.id, existingEmpId));
        if (emp) return { status: 200 as const, body: emp };
      }
      const seqRes: any = await tx.execute(sql`SELECT nextval('employee_number_seq') AS n`);
      const empN = Number(seqRes.rows?.[0]?.n ?? seqRes[0]?.n ?? 1);
      const employeeId = `EMP-${String(empN).padStart(5, "0")}`;
      const [emp] = await tx.insert(employeesTable).values({
        employeeId,
        name: offer.candidate_name ?? offer.candidateName,
        type: offer.worker_type ?? offer.workerType ?? "staff",
        designation: offer.designation,
        companyId: offer.company_id ?? offer.companyId,
        nationality: offer.candidate_nationality ?? offer.candidateNationality,
        joiningDate: offer.joining_date ?? offer.joiningDate,
        personalEmail: offer.candidate_personal_email ?? offer.candidatePersonalEmail,
        personalPhone: offer.candidate_personal_phone ?? offer.candidatePersonalPhone,
        passportNo: offer.candidate_passport_no ?? offer.candidatePassportNo,
        basicSalary: offer.basic_salary ?? offer.basicSalary,
        allowances: offer.allowances,
      }).returning();
      await tx.update(offerLettersTable).set({
        employeeId: emp.id,
        convertedEmployeeId: emp.id,
        convertedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(offerLettersTable.id, id));
      return { status: 201 as const, body: emp };
    });
    res.status(result.status).json(result.body);
  } catch (err) {
    req.log?.error({ err }, "convert-to-employee failed");
    res.status(500).json({ error: "Conversion failed" });
  }
});

// --- Attachments (academic / supporting documents) ---------------------------
// Files live in object storage; the row stores only the object key. Mirrors
// the employee-attachments pattern. Clients call requestUploadUrl + PUT, then
// register the resulting objectKey via POST.
type OfferGuard =
  | { ok: true; row: typeof offerLettersTable.$inferSelect }
  | { ok: false; status: 404 | 403 };
async function loadOfferOr403(req: any, id: number): Promise<OfferGuard> {
  const [row] = await db.select().from(offerLettersTable).where(eq(offerLettersTable.id, id));
  if (!row) return { ok: false, status: 404 };
  if (!scopeFilter(req, [row]).length) return { ok: false, status: 403 };
  return { ok: true, row };
}

async function enrichAttachment(a: typeof offerLetterAttachmentsTable.$inferSelect) {
  const signedUrl = await signObjectKey(a.objectKey);
  let uploadedByName: string | undefined;
  if (a.uploadedById) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, a.uploadedById));
    uploadedByName = u?.name;
  }
  return { ...a, signedUrl, uploadedByName };
}

// Per-letter presigned upload URL — files land under offer-letters/{id}/ prefix
// so the registration step can verify ownership without extra DB lookups.
router.post("/offer-letters/:id/attachments/upload-url", requirePermission("offer_letters", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id), 10);
  const guard = await loadOfferOr403(req, id);
  if (!guard.ok) { res.status(guard.status).json({ error: guard.status === 404 ? "Not found" : "Forbidden" }); return; }
  const { name } = req.body ?? {};
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  try {
    const { uploadURL, objectPath } = await storageService.getObjectEntityUploadURLForPrefix(`offer-letters/${id}`);
    res.json({ uploadURL, objectPath });
  } catch (err: any) {
    req.log.error({ err }, "Failed to generate offer-letter attachment upload URL");
    res.status(500).json({ error: "Could not generate upload URL" });
  }
});

router.get("/offer-letters/:id/attachments", requirePermission("offer_letters", "view"), async (req, res): Promise<void> => {
  const id = parseInt(String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id), 10);
  const guard = await loadOfferOr403(req, id);
  if (!guard.ok) { res.status(guard.status).json({ error: guard.status === 404 ? "Not found" : "Forbidden" }); return; }
  const rows = await db.select().from(offerLetterAttachmentsTable)
    .where(eq(offerLetterAttachmentsTable.offerLetterId, id))
    .orderBy(desc(offerLetterAttachmentsTable.uploadedAt));
  res.json(await Promise.all(rows.map(enrichAttachment)));
});

const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ATTACHMENT_ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "text/plain",
]);

router.post("/offer-letters/:id/attachments", requirePermission("offer_letters", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id), 10);
  const guard = await loadOfferOr403(req, id);
  if (!guard.ok) { res.status(guard.status).json({ error: guard.status === 404 ? "Not found" : "Forbidden" }); return; }
  const { fileName, objectKey, contentType, sizeBytes } = req.body ?? {};
  if (!fileName || !objectKey) {
    res.status(400).json({ error: "fileName and objectKey are required" }); return;
  }
  // Enforce per-letter prefix so only files uploaded via this letter's
  // upload-url endpoint can be linked — prevents cross-letter key injection.
  const expectedPrefix = `/objects/offer-letters/${id}/`;
  if (typeof objectKey !== "string" || !objectKey.startsWith(expectedPrefix)) {
    res.status(400).json({ error: "objectKey must be uploaded via this offer letter's upload-url endpoint" }); return;
  }
  // Server-side size cap (8 MB)
  const size = typeof sizeBytes === "number" ? sizeBytes : null;
  if (size !== null && size > ATTACHMENT_MAX_BYTES) {
    res.status(413).json({ error: "File too large", message: "Maximum attachment size is 8 MB" }); return;
  }
  // Server-side MIME type allow-list
  const mime = contentType ? String(contentType).split(";")[0]!.trim().toLowerCase() : null;
  if (mime && !ATTACHMENT_ALLOWED_TYPES.has(mime)) {
    res.status(415).json({ error: "Unsupported file type", message: "Allowed: PDF, Word, Excel, images, plain text" }); return;
  }
  const [row] = await db.insert(offerLetterAttachmentsTable).values({
    offerLetterId: id,
    fileName: String(fileName).slice(0, 255),
    objectKey,
    contentType: mime ?? null,
    sizeBytes: size,
    uploadedById: req.user?.id ?? null,
  }).returning();
  res.status(201).json(await enrichAttachment(row));
});

router.get("/offer-letters/:id/attachments/:attId/download", requirePermission("offer_letters", "view"), async (req, res): Promise<void> => {
  const id = parseInt(String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id), 10);
  const attId = parseInt(String(Array.isArray(req.params.attId) ? req.params.attId[0] : req.params.attId), 10);
  const guard = await loadOfferOr403(req, id);
  if (!guard.ok) { res.status(guard.status).json({ error: guard.status === 404 ? "Not found" : "Forbidden" }); return; }
  const [att] = await db.select().from(offerLetterAttachmentsTable)
    .where(and(eq(offerLetterAttachmentsTable.id, attId), eq(offerLetterAttachmentsTable.offerLetterId, id)));
  if (!att || !att.objectKey) { res.status(404).json({ error: "Attachment not found" }); return; }
  const url = await signObjectKey(att.objectKey);
  if (!url) { res.status(502).json({ error: "Could not generate download URL" }); return; }
  res.redirect(302, url);
});

router.delete("/offer-letters/:id/attachments/:attId", requirePermission("offer_letters", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id), 10);
  const attId = parseInt(String(Array.isArray(req.params.attId) ? req.params.attId[0] : req.params.attId), 10);
  const guard = await loadOfferOr403(req, id);
  if (!guard.ok) { res.status(guard.status).json({ error: guard.status === 404 ? "Not found" : "Forbidden" }); return; }
  await db.delete(offerLetterAttachmentsTable)
    .where(and(eq(offerLetterAttachmentsTable.id, attId), eq(offerLetterAttachmentsTable.offerLetterId, id)));
  res.json({ success: true });
});

export default router;
