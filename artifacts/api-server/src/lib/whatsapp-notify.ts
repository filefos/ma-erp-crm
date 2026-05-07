import { logger } from "./logger";

const CALLMEBOT_URL = "https://api.callmebot.com/whatsapp.php";

export async function sendLoginAlert(opts: {
  loginUserName: string;
  loginUserEmail: string;
  companyName: string;
  ipAddress?: string;
}): Promise<void> {
  const phone = process.env.LOGIN_NOTIFY_PHONE;
  const apiKey = process.env.CALLMEBOT_API_KEY;

  if (!phone || !apiKey) {
    return;
  }

  const now = new Date().toLocaleString("en-AE", {
    timeZone: "Asia/Dubai",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  const text = [
    `🔐 ERP Login Alert`,
    `User: ${opts.loginUserName}`,
    `Email: ${opts.loginUserEmail}`,
    `Company: ${opts.companyName}`,
    `Time: ${now} (UAE)`,
    opts.ipAddress ? `IP: ${opts.ipAddress}` : "",
  ].filter(Boolean).join("%0A");

  const url = `${CALLMEBOT_URL}?phone=${phone}&text=${text}&apikey=${apiKey}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      logger.warn({ status: res.status }, "CallMeBot WhatsApp alert failed");
    } else {
      logger.info({ user: opts.loginUserEmail }, "Login WhatsApp alert sent");
    }
  } catch (err) {
    logger.warn({ err }, "Login WhatsApp alert request failed (non-fatal)");
  }
}
