import nodemailer from "nodemailer";
import { logger } from "./logger";

function uaeTime(): string {
  return new Date().toLocaleString("en-AE", {
    timeZone: "Asia/Dubai",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

async function sendViaWhatsApp(phone: string, code: string): Promise<boolean> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) return false;

  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: {
          body: `🔐 *Prime ERP — Login OTP*\n\nYour verification code is:\n\n*${code}*\n\nValid for 5 minutes. Do not share this code with anyone.`,
        },
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      logger.warn({ status: res.status, err, phone: cleanPhone }, "WhatsApp OTP send failed");
      return false;
    }

    logger.info({ phone: cleanPhone }, "OTP sent via WhatsApp");
    return true;
  } catch (err) {
    logger.warn({ err, phone: cleanPhone }, "WhatsApp OTP send error");
    return false;
  }
}

async function sendViaEmail(toEmail: string, userName: string, code: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return false;

  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const transporter = nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: { user, pass },
  });

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="background:#0f2d5a;padding:20px 24px">
        <h2 style="margin:0;color:#fff;font-size:20px;font-weight:700">Prime ERP — Login OTP</h2>
        <p style="margin:4px 0 0;color:#93c5fd;font-size:13px">One-time verification code</p>
      </div>
      <div style="padding:28px 24px;background:#fff">
        <p style="margin:0 0 20px;color:#374151;font-size:14px">Hello <strong>${userName}</strong>,</p>
        <p style="margin:0 0 16px;color:#374151;font-size:14px">Your login verification code is:</p>
        <div style="background:#f0f7ff;border:2px dashed #1e6ab0;border-radius:10px;padding:20px;text-align:center;margin:0 0 20px">
          <span style="font-size:40px;font-weight:800;letter-spacing:10px;color:#0f2d5a;font-family:monospace">${code}</span>
        </div>
        <p style="margin:0 0 8px;color:#6b7280;font-size:13px">⏱ This code expires in <strong>5 minutes</strong>.</p>
        <p style="margin:0;color:#6b7280;font-size:13px">🔒 Do not share this code with anyone. Prime ERP staff will never ask for it.</p>
      </div>
      <div style="background:#f9fafb;padding:14px 24px;border-top:1px solid #e5e7eb">
        <p style="margin:0;color:#9ca3af;font-size:12px">${uaeTime()} (UAE) · Prime Max &amp; Elite Prefab ERP</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Prime ERP Security" <${user}>`,
      to: toEmail,
      subject: `${code} — Your Prime ERP Login Code`,
      html,
    });
    logger.info({ to: toEmail }, "OTP sent via Email");
    return true;
  } catch (err) {
    logger.warn({ err, to: toEmail }, "Email OTP send error");
    return false;
  }
}

export interface OtpSendResult {
  whatsapp: boolean;
  email: boolean;
  anySent: boolean;
}

export async function sendOtp(opts: {
  phone: string | null | undefined;
  email: string;
  userName: string;
  code: string;
}): Promise<OtpSendResult> {
  const [whatsapp, email] = await Promise.all([
    opts.phone ? sendViaWhatsApp(opts.phone, opts.code) : Promise.resolve(false),
    sendViaEmail(opts.email, opts.userName, opts.code),
  ]);

  if (!whatsapp && !email) {
    logger.warn(
      { code: opts.code, email: opts.email },
      "OTP delivery not configured — code shown in log for testing"
    );
  }

  return { whatsapp, email, anySent: whatsapp || email };
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/[^0-9+]/g, "");
  if (digits.length <= 4) return "****";
  return digits.slice(0, -4).replace(/[0-9]/g, "*") + digits.slice(-4);
}
