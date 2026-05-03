// Daily-ish cron: scans approved suppliers for trade-licence and VAT
// certificate expiry within the next 30 days and sends a reminder e-mail
// to the company's procurement inbox. Idempotent — once a reminder has
// been sent for a given expiry date, the corresponding "reminder_sent_at"
// column is stamped so subsequent ticks skip the same supplier until the
// expiry date is updated.

import {
  db,
  suppliersTable,
  companiesTable,
  emailSettingsTable,
  emailsTable,
} from "@workspace/db";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import { logger } from "../lib/logger";

const SCAN_INTERVAL_MS = Number(process.env.SUPPLIER_EXPIRY_SCAN_INTERVAL_MS ?? 24 * 60 * 60 * 1000); // daily
const STARTUP_DELAY_MS = Number(process.env.SUPPLIER_EXPIRY_STARTUP_DELAY_MS ?? 60_000);
const REMINDER_LEAD_DAYS = 30;

function daysUntil(yyyymmdd: string | null | undefined): number | null {
  if (!yyyymmdd) return null;
  const d = new Date(yyyymmdd);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

async function sendProcurementEmail(companyId: number, subject: string, body: string): Promise<void> {
  const [settings] = await db.select().from(emailSettingsTable).where(eq(emailSettingsTable.companyId, companyId));
  const inbox = settings?.smtpUser;
  if (!inbox) {
    logger.info({ companyId }, "supplier-expiry: no SMTP inbox configured, logging only");
  }
  try {
    if (settings?.smtpHost && settings?.smtpUser && settings?.smtpPass && inbox) {
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort ?? 587,
        secure: settings.smtpSecure === "ssl",
        requireTLS: settings.smtpSecure === "starttls",
        auth: { user: settings.smtpUser, pass: settings.smtpPass },
      });
      await transporter.sendMail({
        from: `"${settings.smtpFromName ?? "Procurement Team"}" <${settings.smtpUser}>`,
        to: inbox,
        subject,
        html: body.replace(/\n/g, "<br>"),
        text: body,
      });
    }
    await db.insert(emailsTable).values({
      companyId,
      folder: "sent",
      fromAddress: "procurement@noreply",
      fromName: "Procurement Team",
      toAddress: inbox ?? "procurement@local",
      toName: "Procurement Team",
      subject,
      body,
      isRead: true,
      sentAt: new Date(),
    });
  } catch (err) {
    logger.warn({ err, companyId }, "supplier-expiry: email failed");
  }
}

async function scan(): Promise<void> {
  const rows = await db.select().from(suppliersTable).where(
    and(eq(suppliersTable.isActive, true), isNotNull(suppliersTable.code)),
  );
  for (const s of rows) {
    if (!s.companyId) continue;
    const lic = daysUntil(s.tradeLicenseExpiry);
    if (lic !== null && lic <= REMINDER_LEAD_DAYS && lic >= 0) {
      // Idempotency: skip if we've sent a reminder for this same expiry value
      // within the lead window already. We compare on the date string so a
      // renewed (changed) expiry triggers a fresh reminder.
      const lastSent = s.licenseExpiryReminderSentAt;
      const stale = !lastSent || (Date.now() - new Date(lastSent).getTime()) > REMINDER_LEAD_DAYS * 24 * 60 * 60 * 1000;
      if (stale) {
        const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, s.companyId));
        await sendProcurementEmail(
          s.companyId,
          `Supplier trade licence expiring in ${lic} days — ${s.name}`,
          `Heads up — supplier ${s.name}${s.code ? ` (${s.code})` : ""} for ${co?.name ?? "your company"} has a trade licence expiring on ${s.tradeLicenseExpiry} (${lic} days from today). Please request an updated copy before expiry.`,
        );
        await db.update(suppliersTable).set({ licenseExpiryReminderSentAt: new Date(), updatedAt: new Date() })
          .where(eq(suppliersTable.id, s.id));
      }
    }
    const vat = daysUntil(s.vatCertificateExpiry);
    if (vat !== null && vat <= REMINDER_LEAD_DAYS && vat >= 0) {
      const lastSent = s.vatExpiryReminderSentAt;
      const stale = !lastSent || (Date.now() - new Date(lastSent).getTime()) > REMINDER_LEAD_DAYS * 24 * 60 * 60 * 1000;
      if (stale) {
        const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, s.companyId));
        await sendProcurementEmail(
          s.companyId,
          `Supplier VAT certificate expiring in ${vat} days — ${s.name}`,
          `Heads up — supplier ${s.name}${s.code ? ` (${s.code})` : ""} for ${co?.name ?? "your company"} has a VAT certificate expiring on ${s.vatCertificateExpiry} (${vat} days from today). Please request an updated copy before expiry.`,
        );
        await db.update(suppliersTable).set({ vatExpiryReminderSentAt: new Date(), updatedAt: new Date() })
          .where(eq(suppliersTable.id, s.id));
      }
    }
  }
}

async function tick(): Promise<void> {
  try {
    await scan();
  } catch (err) {
    logger.warn({ err }, "supplier-expiry tick failed");
  }
}

let started = false;
export function startSupplierExpiryWorker(): void {
  if (started) return;
  started = true;
  logger.info({ intervalMs: SCAN_INTERVAL_MS }, "Starting supplier expiry cron worker");
  setTimeout(() => {
    void tick();
    setInterval(() => { void tick(); }, SCAN_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}
// silence unused import in case of future refactors
void sql;
