import { logger } from "./logger";

export async function sendSmsOtp(phone: string, code: string): Promise<{ sent: boolean }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    logger.warn(
      "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER not set — OTP not sent via SMS"
    );
    return { sent: false };
  }

  const toNumber = phone.startsWith("+") ? phone : `+${phone.replace(/[^0-9]/g, "")}`;
  const body = `Your ERP login OTP is: ${code}\n\nThis code is valid for 5 minutes. Do not share it with anyone.`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: toNumber, From: fromNumber, Body: body });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      logger.warn({ status: res.status, errBody, to: toNumber }, "Twilio SMS OTP send failed");
      return { sent: false };
    }

    logger.info({ to: toNumber }, "SMS OTP sent via Twilio");
    return { sent: true };
  } catch (err) {
    logger.warn({ err, to: toNumber }, "Twilio SMS OTP send error");
    return { sent: false };
  }
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/[^0-9+]/g, "");
  if (digits.length <= 4) return "****";
  return digits.slice(0, -4).replace(/[0-9]/g, "*") + digits.slice(-4);
}
