import { AutomationChannel } from "@prisma/client";
import { sendEmail } from "@/lib/email";

type NotificationPayload = {
  channel: AutomationChannel;
  to: string;
  subject?: string;
  html?: string;
  text?: string;
};

async function sendWebhook(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Webhook delivery failed");
  }
}

export async function sendNotification(payload: NotificationPayload) {
  const { channel, to, subject, html, text } = payload;

  if (channel === "EMAIL") {
    if (!subject || !html) {
      throw new Error("Email subject and HTML are required");
    }
    await sendEmail({ to, subject, html, text });
    return;
  }

  if (channel === "SMS") {
    const url = process.env.SMS_WEBHOOK_URL;
    if (!url) {
      throw new Error("SMS_WEBHOOK_URL is not configured");
    }
    await sendWebhook(url, { to, message: text ?? subject ?? html ?? "" });
    return;
  }

  if (channel === "WHATSAPP") {
    const url = process.env.WHATSAPP_WEBHOOK_URL;
    if (!url) {
      throw new Error("WHATSAPP_WEBHOOK_URL is not configured");
    }
    await sendWebhook(url, { to, message: text ?? subject ?? html ?? "" });
  }
}

