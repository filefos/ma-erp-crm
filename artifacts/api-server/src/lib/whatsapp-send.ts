import { logger } from "./logger";

export async function sendWhatsAppOtp(phone: string, code: string): Promise<{ sent: boolean; method: string }> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    logger.warn("WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set — OTP not sent via WhatsApp");
    return { sent: false, method: "none" };
  }

  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    to: cleanPhone,
    type: "text",
    text: {
      body: `Your ERP login OTP is: *${code}*\n\nThis code is valid for 5 minutes. Do not share it with anyone.`,
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      logger.warn({ status: res.status, errBody, phone: cleanPhone }, "WhatsApp OTP send failed");
      return { sent: false, method: "whatsapp" };
    }

    logger.info({ phone: cleanPhone }, "WhatsApp OTP sent successfully");
    return { sent: true, method: "whatsapp" };
  } catch (err) {
    logger.warn({ err, phone: cleanPhone }, "WhatsApp OTP send error");
    return { sent: false, method: "whatsapp" };
  }
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/[^0-9+]/g, "");
  if (digits.length <= 4) return "****";
  return digits.slice(0, -4).replace(/[0-9]/g, "*") + digits.slice(-4);
}
