import nodemailer from "nodemailer";
import { logger } from "./logger";

interface LoginAlertOpts {
  loginUserName: string;
  loginUserEmail: string;
  companyName: string;
  ipAddress?: string;
}

function uaeTime(): string {
  return new Date().toLocaleString("en-AE", {
    timeZone: "Asia/Dubai",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

async function sendWhatsApp(opts: LoginAlertOpts): Promise<void> {
  const phone = process.env.LOGIN_NOTIFY_PHONE;
  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (!phone || !apiKey) return;

  const lines = [
    "ERP Login Alert",
    `User: ${opts.loginUserName}`,
    `Email: ${opts.loginUserEmail}`,
    `Company: ${opts.companyName}`,
    `Time: ${uaeTime()} (UAE)`,
    opts.ipAddress ? `IP: ${opts.ipAddress}` : "",
  ].filter(Boolean);

  const text = encodeURIComponent(lines.join("\n"));
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${text}&apikey=${apiKey}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      logger.warn({ status: res.status }, "CallMeBot WhatsApp login alert failed");
    } else {
      logger.info({ user: opts.loginUserEmail }, "Login WhatsApp alert sent via CallMeBot");
    }
  } catch (err) {
    logger.warn({ err }, "Login WhatsApp alert request failed (non-fatal)");
  }
}

async function sendTelegram(opts: LoginAlertOpts): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const text = [
    "🔐 *ERP Login Alert*",
    `👤 *User:* ${opts.loginUserName}`,
    `📧 *Email:* ${opts.loginUserEmail}`,
    `🏢 *Company:* ${opts.companyName}`,
    `🕐 *Time:* ${uaeTime()} \\(UAE\\)`,
    opts.ipAddress ? `🌐 *IP:* ${opts.ipAddress}` : "",
  ].filter(Boolean).join("\n");

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "MarkdownV2" }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      logger.warn({ status: res.status, body }, "Telegram login alert failed");
    } else {
      logger.info({ user: opts.loginUserEmail }, "Login Telegram alert sent");
    }
  } catch (err) {
    logger.warn({ err }, "Login Telegram alert request failed (non-fatal)");
  }
}

async function sendEmail(opts: LoginAlertOpts): Promise<void> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const toEmail = process.env.LOGIN_NOTIFY_EMAIL;
  if (!host || !user || !pass || !toEmail) return;

  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const transporter = nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: { user, pass },
  });

  const now = uaeTime();
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <div style="background:#ea580c;padding:16px 20px">
        <h2 style="margin:0;color:#fff;font-size:18px">🔐 ERP Login Alert</h2>
      </div>
      <div style="padding:20px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#6b7280;width:100px">User</td><td style="padding:6px 0;font-weight:600">${opts.loginUserName}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Email</td><td style="padding:6px 0">${opts.loginUserEmail}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Company</td><td style="padding:6px 0">${opts.companyName}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Time</td><td style="padding:6px 0">${now} (UAE)</td></tr>
          ${opts.ipAddress ? `<tr><td style="padding:6px 0;color:#6b7280">IP Address</td><td style="padding:6px 0">${opts.ipAddress}</td></tr>` : ""}
        </table>
      </div>
      <div style="background:#f9fafb;padding:12px 20px;font-size:12px;color:#9ca3af">
        Prime Max & Elite Prefab ERP — Automated Security Alert
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"ERP Security" <${user}>`,
      to: toEmail,
      subject: `ERP Login: ${opts.loginUserName} — ${now}`,
      html,
    });
    logger.info({ user: opts.loginUserEmail }, "Login email alert sent");
  } catch (err) {
    logger.warn({ err }, "Login email alert failed (non-fatal)");
  }
}

export async function sendLoginAlert(opts: LoginAlertOpts): Promise<void> {
  await Promise.allSettled([
    sendWhatsApp(opts),
    sendTelegram(opts),
    sendEmail(opts),
  ]);
}
