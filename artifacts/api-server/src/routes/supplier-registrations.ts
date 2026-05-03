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
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import nodemailer from "nodemailer";
import { requireAuth, requirePermission, scopeFilter, inScope } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseJson<T = unknown>(str: string | null | undefined, fallback: T): T {
  try { return JSON.parse(str ?? "") as T; } catch { return fallback; }
}

function toResponse(reg: typeof supplierRegistrationsTable.$inferSelect) {
  const atts = parseJson<Array<{ filename: string; contentType: string; size: number; content?: string }>>(reg.attachments, []);
  return {
    ...reg,
    categories: parseJson<string[]>(reg.categories, []),
    // Strip base64 content from list/detail responses (download endpoint serves it)
    attachments: atts.map(a => ({ filename: a.filename, contentType: a.contentType, size: a.size })),
  };
}

async function nextRefNumber(): Promise<string> {
  const yr = new Date().getFullYear();
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(supplierRegistrationsTable);
  const seq = (count ?? 0) + 1;
  return `REG-${yr}-${String(seq).padStart(4, "0")}`;
}

async function notifyApplicant(opts: {
  companyId: number;
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
}) {
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
    // Always log a copy to sent folder so the team has a paper trail.
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
    logger.warn({ err }, "Supplier registration notification failed");
  }
}

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
  const b = req.body ?? {};
  // Required fields
  if (!b.companyId || !b.companyName || !b.contactPerson || !b.email || !b.agreedTerms) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  if (!Array.isArray(b.categories) || b.categories.length === 0) {
    res.status(400).json({ error: "Please select at least one supply category" });
    return;
  }
  // Validate target company exists & is active
  const [target] = await db.select().from(companiesTable).where(eq(companiesTable.id, Number(b.companyId)));
  if (!target) { res.status(400).json({ error: "Invalid company" }); return; }

  // Normalize attachments: validate, cap size (10MB each, 5 files max)
  const rawAtts: Array<{ filename: string; contentType: string; content: string }> = Array.isArray(b.attachments) ? b.attachments : [];
  if (rawAtts.length > 5) { res.status(400).json({ error: "Maximum 5 attachments allowed" }); return; }
  const attachments = rawAtts.slice(0, 5).map(a => ({
    filename: String(a.filename ?? "file").slice(0, 200),
    contentType: String(a.contentType ?? "application/octet-stream"),
    size: typeof a.content === "string" ? Math.floor((a.content.length * 3) / 4) : 0,
    content: typeof a.content === "string" ? a.content : "",
  }));
  for (const a of attachments) {
    if (a.size > 10 * 1024 * 1024) {
      res.status(400).json({ error: `File ${a.filename} exceeds 10MB limit` });
      return;
    }
  }

  const refNumber = await nextRefNumber();
  const ip = (req.ip ?? "").slice(0, 64);
  const [reg] = await db.insert(supplierRegistrationsTable).values({
    refNumber,
    companyId: Number(b.companyId),
    status: "pending",
    companyName: String(b.companyName).slice(0, 500),
    tradeLicenseNo: b.tradeLicenseNo ?? null,
    licenseExpiry: b.licenseExpiry ?? null,
    establishedYear: b.establishedYear ?? null,
    companySize: b.companySize ?? null,
    country: b.country ?? null,
    city: b.city ?? null,
    address: b.address ?? null,
    website: b.website ?? null,
    contactPerson: String(b.contactPerson).slice(0, 200),
    designation: b.designation ?? null,
    email: String(b.email).slice(0, 200),
    phone: b.phone ?? null,
    whatsapp: b.whatsapp ?? null,
    trn: b.trn ?? null,
    vatRegistered: Boolean(b.vatRegistered),
    chamberMembership: b.chamberMembership ?? null,
    bankName: b.bankName ?? null,
    bankAccountName: b.bankAccountName ?? null,
    bankAccountNumber: b.bankAccountNumber ?? null,
    iban: b.iban ?? null,
    swift: b.swift ?? null,
    currency: b.currency ?? "AED",
    categories: JSON.stringify(b.categories),
    paymentTerms: b.paymentTerms ?? null,
    deliveryTerms: b.deliveryTerms ?? null,
    yearsExperience: b.yearsExperience ?? null,
    majorClients: b.majorClients ?? null,
    attachments: JSON.stringify(attachments),
    agreedTerms: Boolean(b.agreedTerms),
    ipAddress: ip || null,
  }).returning();

  // Acknowledge applicant
  await notifyApplicant({
    companyId: reg.companyId,
    toEmail: reg.email,
    toName: reg.contactPerson,
    subject: `Application received — ${refNumber}`,
    body: `Dear ${reg.contactPerson},\n\nThank you for registering ${reg.companyName} as a supplier with ${target.name}.\n\nYour reference number is ${refNumber}. Our procurement team will review your application and get back to you shortly. Please retain this reference for any follow-up correspondence.\n\nKind regards,\n${target.name} Procurement Team`,
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

router.get("/supplier-applications/:id/attachments/:idx", requireAuth, requirePermission("suppliers", "view"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const idx = parseInt(String(req.params.idx), 10);
  const [reg] = await db.select().from(supplierRegistrationsTable).where(eq(supplierRegistrationsTable.id, id));
  if (!reg) { res.status(404).json({ error: "Not found" }); return; }
  if (!inScope(req, reg.companyId)) { res.status(403).json({ error: "Forbidden" }); return; }
  const atts = parseJson<Array<{ filename: string; contentType: string; size: number; content?: string }>>(reg.attachments, []);
  const att = atts[idx];
  if (!att?.content) { res.status(404).json({ error: "Attachment not found" }); return; }
  const buf = Buffer.from(att.content, "base64");
  res.setHeader("Content-Type", att.contentType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${att.filename}"`);
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
  if (!["approve", "reject", "needs_info"].includes(decision)) {
    res.status(400).json({ error: "Invalid decision" });
    return;
  }

  let supplierIdCreated: number | null = reg.supplierIdCreated;
  let newStatus = reg.status;

  if (decision === "approve") {
    if (!supplierIdCreated) {
      // Avoid duplicates: if a supplier with same TRN or email already exists in this company, link instead of creating.
      let existing: typeof suppliersTable.$inferSelect | undefined;
      if (reg.trn) {
        [existing] = await db.select().from(suppliersTable).where(and(eq(suppliersTable.companyId, reg.companyId), eq(suppliersTable.trn, reg.trn)));
      }
      if (!existing && reg.email) {
        [existing] = await db.select().from(suppliersTable).where(and(eq(suppliersTable.companyId, reg.companyId), eq(suppliersTable.email, reg.email)));
      }
      if (existing) {
        supplierIdCreated = existing.id;
      } else {
        const cats = parseJson<string[]>(reg.categories, []);
        const [created] = await db.insert(suppliersTable).values({
          companyId: reg.companyId,
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
          status: "active",
          notes: `Auto-created from supplier application ${reg.refNumber}.${cats.length > 1 ? `\nCategories: ${cats.join(", ")}` : ""}`,
          isActive: true,
        }).returning();
        supplierIdCreated = created.id;
      }
    }
    newStatus = "approved";
  } else if (decision === "reject") {
    newStatus = "rejected";
  } else {
    newStatus = "needs_info";
  }

  const [updated] = await db.update(supplierRegistrationsTable).set({
    status: newStatus,
    reviewedById: req.user?.id ?? null,
    reviewedAt: new Date(),
    reviewNotes: notes,
    supplierIdCreated,
    updatedAt: new Date(),
  }).where(eq(supplierRegistrationsTable.id, id)).returning();

  // Notify applicant
  const [target] = await db.select().from(companiesTable).where(eq(companiesTable.id, reg.companyId));
  const targetName = target?.name ?? "Procurement Team";
  let subject = "";
  let body = "";
  if (newStatus === "approved") {
    subject = `Application approved — ${reg.refNumber}`;
    body = `Dear ${reg.contactPerson},\n\nWe are pleased to confirm that ${reg.companyName} has been approved as an authorized supplier for ${targetName}.\n\nReference: ${reg.refNumber}\n\nOur procurement team will be in touch with next steps. ${notes ? `\n\nNotes: ${notes}` : ""}\n\nKind regards,\n${targetName} Procurement Team`;
  } else if (newStatus === "rejected") {
    subject = `Application update — ${reg.refNumber}`;
    body = `Dear ${reg.contactPerson},\n\nThank you for your interest in supplying ${targetName}. After review, we are unable to proceed with your application at this time.\n\nReference: ${reg.refNumber}${notes ? `\n\nNotes: ${notes}` : ""}\n\nKind regards,\n${targetName} Procurement Team`;
  } else {
    subject = `Additional information requested — ${reg.refNumber}`;
    body = `Dear ${reg.contactPerson},\n\nThank you for your application to supply ${targetName}. We need some additional information to complete our review.\n\nReference: ${reg.refNumber}${notes ? `\n\nDetails: ${notes}` : ""}\n\nPlease reply to this email with the requested details.\n\nKind regards,\n${targetName} Procurement Team`;
  }
  await notifyApplicant({ companyId: reg.companyId, toEmail: reg.email, toName: reg.contactPerson, subject, body });

  res.json(toResponse(updated));
});

export default router;
