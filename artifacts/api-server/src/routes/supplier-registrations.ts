import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import {
  db,
  supplierRegistrationsTable,
  supplierCategoriesTable,
  suppliersTable,
  companiesTable,
  emailsTable,
  emailSettingsTable,
  notificationsTable,
  userCompanyAccessTable,
  usersTable,
  supplierInvitesTable,
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import nodemailer from "nodemailer";
import {
  requireAuth,
  requirePermission,
  scopeFilter,
  inScope,
  hasPermission,
} from "../middlewares/auth";
import { logger } from "../lib/logger";
import { SubmitSupplierRegistrationBody as SubmitSupplierRegistrationSchema } from "@workspace/api-zod";

const router = Router();

// Per-file attachment cap (5 MB per spec).
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 6; // trade licence, VAT, bank ref, EID, ISO, insurance

// Documents the applicant MUST attach (VAT cert is conditionally required when
// they declare themselves VAT-registered; checked separately below).
const REQUIRED_DOC_TYPES = ["trade_licence", "bank_reference", "signatory_id"] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseJson<T = unknown>(str: string | null | undefined, fallback: T): T {
  try { return JSON.parse(str ?? "") as T; } catch { return fallback; }
}

function toInviteResponse(invite: typeof supplierInvitesTable.$inferSelect, req: { protocol: string; get(h: string): string | undefined }) {
  const proto = (process.env.NODE_ENV === "production") ? "https" : req.protocol;
  const host = req.get("host") ?? "localhost";
  const registrationLink = `${proto}://${host}/supplier-register?invite=${invite.token}`;
  return { ...invite, registrationLink };
}

function toResponse(reg: typeof supplierRegistrationsTable.$inferSelect) {
  const atts = parseJson<Array<{ filename: string; contentType: string; size: number; content?: string }>>(reg.attachments, []);
  const refs = parseJson<Array<{ name?: string; contact?: string }>>(reg.referenceClients, []);
  return {
    ...reg,
    categories: parseJson<string[]>(reg.categories, []),
    referenceClients: refs,
    // Strip base64 content from list/detail responses (download endpoint serves it)
    attachments: atts.map(a => ({ filename: a.filename, contentType: a.contentType, size: a.size })),
  };
}

/**
 * Generate the next REG-YYYY-#### reference number. MUST be called inside a
 * transaction; takes a postgres advisory transaction lock keyed on the year so
 * concurrent submissions cannot mint duplicate ref numbers (the table also has
 * a unique constraint on `ref_number` as the last-line-of-defence).
 */
async function nextRefNumberTx(tx: Tx): Promise<string> {
  const yr = new Date().getFullYear();
  // Advisory lock per-year — auto-released at tx end.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${sql.raw(String(yr))})`);
  const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` })
    .from(supplierRegistrationsTable)
    .where(sql`ref_number LIKE ${`REG-${yr}-%`}`);
  const seq = (count ?? 0) + 1;
  return `REG-${yr}-${String(seq).padStart(4, "0")}`;
}

/**
 * Generate the next supplier code for a company. MUST be called inside a
 * transaction that already holds a row-level lock on the companies row
 * (`SELECT ... FOR UPDATE`) so concurrent approvals can't race and produce
 * duplicates. The unique partial index `suppliers_code_company_idx` is the
 * last-line-of-defence — this lock is the primary safeguard.
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function nextSupplierCodeTx(tx: Tx, companyId: number): Promise<string> {
  const [co] = await tx.select({ prefix: companiesTable.prefix }).from(companiesTable).where(eq(companiesTable.id, companyId));
  const prefix = co?.prefix ?? "PM";
  const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` })
    .from(suppliersTable)
    .where(and(eq(suppliersTable.companyId, companyId), sql`${suppliersTable.code} IS NOT NULL`));
  const seq = (count ?? 0) + 1;
  return `SUP-${prefix}-${String(seq).padStart(4, "0")}`;
}

interface SendArgs {
  companyId: number;
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
}

async function sendEmail(opts: SendArgs) {
  try {
    const [settings] = await db.select().from(emailSettingsTable).where(eq(emailSettingsTable.companyId, opts.companyId));
    if (settings?.smtpHost && settings?.smtpUser && settings?.smtpPass) {
      const fromName = settings.smtpFromName ?? "Procurement Team";
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort ?? 587,
        secure: settings.smtpSecure === "ssl",
        requireTLS: settings.smtpSecure === "starttls",
        auth: { user: settings.smtpUser, pass: settings.smtpPass },
      });
      await transporter.sendMail({
        from: `"${fromName}" <${settings.smtpUser}>`,
        to: opts.toEmail,
        subject: opts.subject,
        html: opts.body.replace(/\n/g, "<br>"),
        text: opts.body,
      });
    }
    await db.insert(emailsTable).values({
      companyId: opts.companyId,
      folder: "sent",
      fromAddress: "procurement@noreply",
      fromName: "Procurement Team",
      toAddress: opts.toEmail,
      toName: opts.toName,
      subject: opts.subject,
      body: opts.body,
      isRead: true,
      sentAt: new Date(),
    });
  } catch (err) {
    logger.warn({ err, to: opts.toEmail }, "Supplier registration email failed");
  }
}

/**
 * Notify procurement team for a company:
 *  - email to the company's procurement inbox (smtpFromEmail / smtpUser)
 *  - in-app notification to every active user in that company who has
 *    suppliers:view permission.
 */
async function notifyProcurement(opts: {
  companyId: number;
  subject: string;
  body: string;
  entityId: number;
  refNumber: string;
}) {
  try {
    const [settings] = await db.select().from(emailSettingsTable).where(eq(emailSettingsTable.companyId, opts.companyId));
    const inbox = settings?.smtpUser;
    if (inbox) {
      await sendEmail({
        companyId: opts.companyId,
        toEmail: inbox,
        toName: "Procurement Team",
        subject: opts.subject,
        body: opts.body,
      });
    }
    // In-app notifications — all active users in this company with
    // suppliers:view. We parallelise the per-user permission check + insert
    // with Promise.all so a company with many users doesn't serialise
    // hundreds of round-trips.
    const accessRows = await db
      .select({ id: usersTable.id, name: usersTable.name, isActive: usersTable.isActive, permissionLevel: usersTable.permissionLevel, role: usersTable.role })
      .from(userCompanyAccessTable)
      .innerJoin(usersTable, eq(usersTable.id, userCompanyAccessTable.userId))
      .where(eq(userCompanyAccessTable.companyId, opts.companyId));
    const message = opts.body.split("\n")[0]?.slice(0, 240) ?? opts.refNumber;
    await Promise.all(accessRows
      .filter(u => u.isActive !== false)
      .map(async u => {
        const allowed = await hasPermission(u as never, "suppliers", "view");
        if (!allowed) return;
        await db.insert(notificationsTable).values({
          userId: u.id,
          title: opts.subject,
          message,
          type: "info",
          entityType: "supplier_registration",
          entityId: opts.entityId,
        });
      }));
  } catch (err) {
    logger.warn({ err }, "Procurement notification failed");
  }
}

// ─── Public: list active companies (no auth) ───────────────────────────────

router.get("/public/companies", async (_req, res) => {
  const rows = await db
    .select({
      id: companiesTable.id,
      name: companiesTable.name,
      shortName: companiesTable.shortName,
      prefix: companiesTable.prefix,
    })
    .from(companiesTable)
    .where(eq(companiesTable.isActive, true))
    .orderBy(companiesTable.id);
  res.json(rows);
});

// ─── Public: list categories ────────────────────────────────────────────────

router.get("/supplier-categories", async (_req, res) => {
  const rows = await db.select().from(supplierCategoriesTable)
    .where(eq(supplierCategoriesTable.isActive, true))
    .orderBy(supplierCategoriesTable.sortOrder);
  res.json(rows);
});

// ─── Public: submit registration ────────────────────────────────────────────

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  message: { error: "Too many submissions. Please try again later." },
});

router.post("/supplier-register", submitLimiter, async (req, res): Promise<void> => {
  // Strict schema validation derived from the OpenAPI spec (zod). Enforces
  // every required field per the Required Fields contract for the public form.
  const parsed = SubmitSupplierRegistrationSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join(".") || "body";
    res.status(400).json({ error: `Invalid submission (${path}): ${first?.message ?? "validation failed"}`, issues: parsed.error.issues });
    return;
  }
  const b = parsed.data;

  if (!b.agreedTerms || !b.agreedCodeOfConduct) {
    res.status(400).json({ error: "Both declarations must be accepted to submit." });
    return;
  }
  if (b.categories.length === 0) {
    res.status(400).json({ error: "Please select at least one supply category" });
    return;
  }
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) {
    res.status(400).json({ error: "A valid contact email is required." });
    return;
  }
  if (b.vatRegistered && !b.trn?.trim()) {
    res.status(400).json({ error: "VAT TRN is required when VAT-registered." });
    return;
  }

  const [target] = await db.select().from(companiesTable).where(eq(companiesTable.id, Number(b.companyId)));
  if (!target) { res.status(400).json({ error: "Invalid company" }); return; }

  // Normalize attachments
  const rawAtts = Array.isArray(b.attachments) ? b.attachments : [];
  if (rawAtts.length > MAX_FILES) { res.status(400).json({ error: `Maximum ${MAX_FILES} attachments allowed` }); return; }
  const attachments = rawAtts.map(a => ({
    filename: String(a.filename ?? "file").slice(0, 200),
    contentType: String(a.contentType ?? "application/octet-stream"),
    size: typeof a.content === "string" ? Math.floor((a.content.length * 3) / 4) : 0,
    content: typeof a.content === "string" ? a.content : "",
    documentType: a.documentType ?? "other",
  }));
  for (const a of attachments) {
    if (a.size > MAX_FILE_BYTES) {
      res.status(400).json({ error: `File ${a.filename} exceeds 5MB limit` });
      return;
    }
  }
  // Required documents per spec: trade licence, bank reference, signatory ID
  // (VAT certificate additionally required when applicant is VAT-registered).
  const presentTypes = new Set<string>(attachments.map(a => a.documentType));
  const missing: string[] = REQUIRED_DOC_TYPES.filter(t => !presentTypes.has(t));
  if (b.vatRegistered && !presentTypes.has("vat_certificate")) missing.push("vat_certificate");
  if (missing.length > 0) {
    res.status(400).json({
      error: `Missing required documents: ${missing.join(", ")}. Please upload all mandatory supporting documents before submitting.`,
    });
    return;
  }

  const ip = (req.ip ?? "").slice(0, 64);
  const refClients = Array.isArray(b.referenceClients) ? b.referenceClients.slice(0, 3) : [];

  // Mint ref_number and insert in a single transaction so a unique-constraint
  // collision can never escape and so the advisory lock covers both reads.
  const reg = await db.transaction(async (tx) => {
    const refNumber = await nextRefNumberTx(tx);
    const [row] = await tx.insert(supplierRegistrationsTable).values({
      refNumber,
      companyId: Number(b.companyId),
      status: "pending_review",
      companyName: String(b.companyName).slice(0, 500),
      tradeName: b.tradeName ?? null,
      tradeLicenseNo: b.tradeLicenseNo ?? null,
      licenseAuthority: b.licenseAuthority ?? null,
      licenseExpiry: b.licenseExpiry ?? null,
      establishedYear: b.establishedYear ?? null,
      companySize: b.companySize ?? null,
      country: b.country ?? null,
      city: b.city ?? null,
      emirate: b.emirate ?? null,
      poBox: b.poBox ?? null,
      address: b.address ?? null,
      website: b.website ?? null,
      contactPerson: String(b.contactPerson).slice(0, 200),
      designation: b.designation ?? null,
      email: String(b.email).slice(0, 200),
      phone: b.phone ?? null,
      whatsapp: b.whatsapp ?? null,
      tenderContactName: b.tenderContactName ?? null,
      tenderContactMobile: b.tenderContactMobile ?? null,
      tenderContactEmail: b.tenderContactEmail ?? null,
      trn: b.trn ?? null,
      vatRegistered: Boolean(b.vatRegistered),
      vatCertificateExpiry: b.vatCertificateExpiry ?? null,
      chamberMembership: b.chamberMembership ?? null,
      bankName: b.bankName ?? null,
      bankBranch: b.bankBranch ?? null,
      bankAccountName: b.bankAccountName ?? null,
      bankAccountNumber: b.bankAccountNumber ?? null,
      iban: b.iban ?? null,
      swift: b.swift ?? null,
      currency: b.currency ?? "AED",
      categories: JSON.stringify(b.categories),
      categoriesOther: b.categoriesOther ?? null,
      paymentTerms: b.paymentTerms ?? null,
      deliveryTerms: b.deliveryTerms ?? null,
      yearsExperience: b.yearsExperience ?? null,
      turnoverBand: b.turnoverBand ?? null,
      employeeBand: b.employeeBand ?? null,
      referenceClients: JSON.stringify(refClients),
      majorClients: b.majorClients ?? null,
      attachments: JSON.stringify(attachments),
      agreedTerms: Boolean(b.agreedTerms),
      agreedCodeOfConduct: Boolean(b.agreedCodeOfConduct),
      ipAddress: ip || null,
      inviteToken: (b as any).inviteToken ? String((b as any).inviteToken).slice(0, 100) : null,
    }).returning();
    return row;
  });

  // Mark the invite as used (if one was provided and is still pending)
  if ((b as any).inviteToken) {
    const tok = String((b as any).inviteToken);
    const [inv] = await db.select().from(supplierInvitesTable).where(eq(supplierInvitesTable.token, tok));
    if (inv && inv.status === "pending") {
      await db.update(supplierInvitesTable).set({
        status: "used",
        usedAt: new Date(),
        registrationId: reg.id,
      }).where(eq(supplierInvitesTable.id, inv.id));
    }
  }

  // Acknowledge applicant
  await sendEmail({
    companyId: reg.companyId,
    toEmail: reg.email,
    toName: reg.contactPerson,
    subject: `Application received — ${reg.refNumber}`,
    body: `Dear ${reg.contactPerson},\n\nThank you for registering ${reg.companyName} as a supplier with ${target.name}.\n\nYour reference number is ${reg.refNumber}. Our procurement team will review your application and get back to you shortly. Please retain this reference for any follow-up correspondence.\n\nKind regards,\n${target.name} Procurement Team`,
  });

  // Notify procurement (email to company inbox + in-app to suppliers:view users)
  await notifyProcurement({
    companyId: reg.companyId,
    entityId: reg.id,
    refNumber: reg.refNumber,
    subject: `New supplier application — ${reg.refNumber}`,
    body: `A new supplier application has been submitted via the public portal.\n\nReference: ${reg.refNumber}\nCompany: ${reg.companyName}\nContact: ${reg.contactPerson} <${reg.email}>\nCategories: ${(parseJson<string[]>(reg.categories, [])).join(", ")}\n\nReview at /procurement/applications.`,
  });

  res.status(201).json(toResponse(reg));
});

// ─── Admin: queue / detail / decision / attachment download ─────────────────

router.get("/supplier-applications", requireAuth, requirePermission("suppliers", "view"), async (req, res) => {
  let rows = await db.select().from(supplierRegistrationsTable).orderBy(sql`${supplierRegistrationsTable.createdAt} desc`);
  rows = scopeFilter(req, rows);
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  if (status) rows = rows.filter(r => r.status === status);
  res.json(rows.map(toResponse));
});

router.get("/supplier-applications/:id", requireAuth, requirePermission("suppliers", "view"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [reg] = await db.select().from(supplierRegistrationsTable).where(eq(supplierRegistrationsTable.id, id));
  if (!reg) { res.status(404).json({ error: "Not found" }); return; }
  if (!inScope(req, reg.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(toResponse(reg));
});

// Accepts Bearer token via Authorization header OR ?token= query param
// (query-param form is required for <iframe src> and <a href download>
//  which the browser cannot send custom headers for).
router.get("/supplier-applications/:id/attachments/:idx", async (req, res): Promise<void> => {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (typeof req.query.token === "string") {
    token = req.query.token;
  }
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { getUserFromToken } = await import("../lib/auth");
  const user = await getUserFromToken(token);
  if (!user || !user.isActive) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(String(req.params.id), 10);
  const idx = parseInt(String(req.params.idx), 10);
  const [reg] = await db.select().from(supplierRegistrationsTable).where(eq(supplierRegistrationsTable.id, id));
  if (!reg) { res.status(404).json({ error: "Not found" }); return; }

  const userCompanyIds: number[] = (user as any).companyIds ?? ((user as any).companyId ? [(user as any).companyId] : []);
  const isSuperAdmin = (user as any).role === "super_admin" || (user as any).permissionLevel === "super_admin";
  if (!isSuperAdmin && userCompanyIds.length > 0 && !userCompanyIds.includes(reg.companyId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const atts = parseJson<Array<{ filename: string; contentType: string; size: number; content?: string }>>(reg.attachments, []);
  const att = atts[idx];
  if (!att?.content) { res.status(404).json({ error: "Attachment not found" }); return; }
  const buf = Buffer.from(att.content, "base64");
  const disposition = req.query.download === "1" ? "attachment" : "inline";
  res.setHeader("Content-Type", att.contentType || "application/octet-stream");
  res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(att.filename)}"`);
  res.setHeader("Content-Length", buf.length);
  res.send(buf);
});

router.post("/supplier-applications/:id/decision", requireAuth, requirePermission("suppliers", "edit"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [reg] = await db.select().from(supplierRegistrationsTable).where(eq(supplierRegistrationsTable.id, id));
  if (!reg) { res.status(404).json({ error: "Not found" }); return; }
  if (!inScope(req, reg.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const decision = String(req.body?.decision ?? "");
  const notes = req.body?.notes ? String(req.body.notes) : null;
  if (!["approve", "reject", "more_info_needed"].includes(decision)) {
    res.status(400).json({ error: "Invalid decision" });
    return;
  }

  let supplierIdCreated: number | null = reg.supplierIdCreated;
  let newStatus = reg.status;
  let supplierCode: string | null = null;
  let updated: typeof supplierRegistrationsTable.$inferSelect;

  if (decision === "approve") {
    // Wrap the whole approval block in a transaction. Serialise concurrent
    // approvals for the same company by taking a row-level lock on the
    // companies row before counting/inserting suppliers — this prevents two
    // simultaneous approvals from minting the same SUP-PM-#### code.
    updated = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM companies WHERE id = ${reg.companyId} FOR UPDATE`);

      let _supplierId = supplierIdCreated;
      if (!_supplierId) {
        // De-dup by TRN, then by email — but always make sure the resulting
        // supplier carries a SUP-PM/EP-#### code so it slots cleanly into
        // the RFQ / quotation / LPO flows.
        let existing: typeof suppliersTable.$inferSelect | undefined;
        if (reg.trn) {
          [existing] = await tx.select().from(suppliersTable).where(and(eq(suppliersTable.companyId, reg.companyId), eq(suppliersTable.trn, reg.trn)));
        }
        if (!existing && reg.email) {
          [existing] = await tx.select().from(suppliersTable).where(and(eq(suppliersTable.companyId, reg.companyId), eq(suppliersTable.email, reg.email)));
        }
        if (existing) {
          _supplierId = existing.id;
          if (!existing.code) {
            supplierCode = await nextSupplierCodeTx(tx, reg.companyId);
            await tx.update(suppliersTable).set({
              code: supplierCode,
              tradeLicenseExpiry: existing.tradeLicenseExpiry ?? reg.licenseExpiry ?? null,
              vatCertificateExpiry: existing.vatCertificateExpiry ?? reg.vatCertificateExpiry ?? null,
              updatedAt: new Date(),
            }).where(eq(suppliersTable.id, existing.id));
          } else {
            supplierCode = existing.code;
          }
        } else {
          const cats = parseJson<string[]>(reg.categories, []);
          supplierCode = await nextSupplierCodeTx(tx, reg.companyId);
          const [created] = await tx.insert(suppliersTable).values({
            companyId: reg.companyId,
            code: supplierCode,
            name: reg.companyName,
            contactPerson: reg.contactPerson,
            email: reg.email,
            phone: reg.phone,
            whatsapp: reg.whatsapp,
            address: reg.address,
            trn: reg.trn,
            website: reg.website,
            category: cats[0] ?? null,
            paymentTerms: reg.paymentTerms,
            bankName: reg.bankName,
            bankAccountName: reg.bankAccountName,
            bankAccountNumber: reg.bankAccountNumber,
            iban: reg.iban,
            tradeLicenseExpiry: reg.licenseExpiry ?? null,
            vatCertificateExpiry: reg.vatCertificateExpiry ?? null,
            status: "active",
            notes: `Auto-created from supplier application ${reg.refNumber}.${cats.length > 1 ? `\nCategories: ${cats.join(", ")}` : ""}${reg.categoriesOther ? `\nOther: ${reg.categoriesOther}` : ""}`,
            isActive: true,
          }).returning();
          _supplierId = created.id;
        }
      }

      const [u] = await tx.update(supplierRegistrationsTable).set({
        status: "approved",
        reviewedById: req.user?.id ?? null,
        reviewedAt: new Date(),
        reviewNotes: notes,
        supplierIdCreated: _supplierId,
        updatedAt: new Date(),
      }).where(eq(supplierRegistrationsTable.id, id)).returning();
      return u;
    });
    supplierIdCreated = updated.supplierIdCreated;
    newStatus = updated.status;
  } else {
    newStatus = decision === "reject" ? "rejected" : "more_info_needed";
    [updated] = await db.update(supplierRegistrationsTable).set({
      status: newStatus,
      reviewedById: req.user?.id ?? null,
      reviewedAt: new Date(),
      reviewNotes: notes,
      updatedAt: new Date(),
    }).where(eq(supplierRegistrationsTable.id, id)).returning();
  }

  // Notify applicant
  const [target] = await db.select().from(companiesTable).where(eq(companiesTable.id, reg.companyId));
  const targetName = target?.name ?? "Procurement Team";
  let subject = "";
  let body = "";
  if (newStatus === "approved") {
    subject = `Application approved — ${reg.refNumber}`;
    body = `Dear ${reg.contactPerson},\n\nWe are pleased to confirm that ${reg.companyName} has been approved as an authorized supplier for ${targetName}.${supplierCode ? `\n\nYour supplier code: ${supplierCode}` : ""}\n\nReference: ${reg.refNumber}\n\nOur procurement team will be in touch with next steps.${notes ? `\n\nNotes: ${notes}` : ""}\n\nKind regards,\n${targetName} Procurement Team`;
  } else if (newStatus === "rejected") {
    subject = `Application update — ${reg.refNumber}`;
    body = `Dear ${reg.contactPerson},\n\nThank you for your interest in supplying ${targetName}. After review, we are unable to proceed with your application at this time.\n\nReference: ${reg.refNumber}${notes ? `\n\nNotes: ${notes}` : ""}\n\nKind regards,\n${targetName} Procurement Team`;
  } else {
    subject = `Additional information requested — ${reg.refNumber}`;
    body = `Dear ${reg.contactPerson},\n\nThank you for your application to supply ${targetName}. We need some additional information to complete our review.\n\nReference: ${reg.refNumber}${notes ? `\n\nDetails: ${notes}` : ""}\n\nPlease reply to this email with the requested details.\n\nKind regards,\n${targetName} Procurement Team`;
  }
  await sendEmail({ companyId: reg.companyId, toEmail: reg.email, toName: reg.contactPerson, subject, body });

  // Procurement gets a state-change email + in-app notification too.
  await notifyProcurement({
    companyId: reg.companyId,
    entityId: reg.id,
    refNumber: reg.refNumber,
    subject: `Supplier application ${newStatus} — ${reg.refNumber}`,
    body: `${reg.companyName} (${reg.refNumber}) was marked ${newStatus} by ${req.user?.name ?? "a reviewer"}.${supplierCode ? `\nSupplier code: ${supplierCode}` : ""}${notes ? `\nNotes: ${notes}` : ""}`,
  });

  res.json(toResponse(updated));
});

// ─── Admin: create invite link ───────────────────────────────────────────────

router.post("/supplier-invites", requireAuth, requirePermission("suppliers", "edit"), async (req, res): Promise<void> => {
  const companyId = Number(req.body?.companyId);
  if (!companyId) { res.status(400).json({ error: "companyId required" }); return; }
  if (!inScope(req, companyId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
  if (!company) { res.status(400).json({ error: "Invalid company" }); return; }

  const token = crypto.randomUUID();
  const userId = (req as any).user?.id;
  const [invite] = await db.insert(supplierInvitesTable).values({
    token,
    companyId,
    supplierEmail: req.body?.supplierEmail ? String(req.body.supplierEmail).slice(0, 200) : null,
    supplierCompanyName: req.body?.supplierCompanyName ? String(req.body.supplierCompanyName).slice(0, 300) : null,
    status: "pending",
    createdById: userId,
  }).returning();
  res.status(201).json(toInviteResponse(invite, req));
});

// ─── Admin: list invite links ────────────────────────────────────────────────

router.get("/supplier-invites", requireAuth, requirePermission("suppliers", "view"), async (req, res) => {
  let rows = await db.select().from(supplierInvitesTable).orderBy(sql`${supplierInvitesTable.createdAt} desc`);
  rows = rows.filter(r => inScope(req, r.companyId));
  res.json(rows.map(r => toInviteResponse(r, req)));
});

// ─── Public: look up invite by token (for the registration form) ─────────────

router.get("/supplier-invite/:token", async (req, res): Promise<void> => {
  const { token } = req.params;
  const [invite] = await db.select().from(supplierInvitesTable).where(eq(supplierInvitesTable.token, token));
  if (!invite) { res.status(404).json({ error: "Invite not found" }); return; }
  if (invite.status === "used") { res.status(410).json({ error: "This invite link has already been used" }); return; }
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    await db.update(supplierInvitesTable).set({ status: "expired" }).where(eq(supplierInvitesTable.id, invite.id));
    res.status(410).json({ error: "This invite link has expired" });
    return;
  }
  res.json(toInviteResponse(invite, req));
});

export default router;
