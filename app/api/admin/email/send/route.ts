import { getAdminSession } from "@/lib/auth/admin";
import { getEmailHealthStatus, sendEmail } from "@/lib/email";
import {
  createApiContext,
  jsonError,
  jsonOk,
  logApiError,
  logApiSuccess,
  logApiWarning,
  maskEmail,
} from "@/lib/utils/api";

type SendEmailRequestBody = {
  to?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 30;
const MAX_SUBJECT_LENGTH = 200;
const MAX_CONTENT_LENGTH = 20000;

function parseRecipients(input?: string | string[]) {
  const raw = Array.isArray(input) ? input.join(",") : input ?? "";
  const values = raw
    .split(/[\n,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(values)];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtmlFromText(text: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111;">${escapeHtml(
    text,
  ).replace(/\n/g, "<br />")}</div>`;
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  let body: SendEmailRequestBody;
  try {
    body = (await request.json()) as SendEmailRequestBody;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  const recipients = parseRecipients(body.to);
  if (!recipients.length) {
    logApiWarning(ctx, 400, { reason: "missing_recipients" });
    return jsonError("At least one recipient is required", 400, ctx, {
      code: "MISSING_RECIPIENTS",
    });
  }

  if (recipients.length > MAX_RECIPIENTS) {
    logApiWarning(ctx, 400, { reason: "too_many_recipients", count: recipients.length });
    return jsonError(`Maximum ${MAX_RECIPIENTS} recipients per send`, 400, ctx, {
      code: "TOO_MANY_RECIPIENTS",
    });
  }

  const invalidRecipients = recipients.filter((recipient) => !EMAIL_REGEX.test(recipient));
  if (invalidRecipients.length > 0) {
    logApiWarning(ctx, 400, {
      reason: "invalid_recipients",
      invalidRecipients: invalidRecipients.map((recipient) => maskEmail(recipient)),
    });
    return jsonError("One or more recipient emails are invalid", 400, ctx, {
      code: "INVALID_RECIPIENTS",
      invalidRecipients,
    });
  }

  const subject = body.subject?.trim() ?? "";
  if (!subject) {
    logApiWarning(ctx, 400, { reason: "missing_subject" });
    return jsonError("Subject is required", 400, ctx, { code: "MISSING_SUBJECT" });
  }

  if (subject.length > MAX_SUBJECT_LENGTH) {
    logApiWarning(ctx, 400, { reason: "subject_too_long", length: subject.length });
    return jsonError(`Subject cannot exceed ${MAX_SUBJECT_LENGTH} characters`, 400, ctx, {
      code: "SUBJECT_TOO_LONG",
    });
  }

  const text = body.text?.trim() ?? "";
  const html = body.html?.trim() ?? "";

  if (!text && !html) {
    logApiWarning(ctx, 400, { reason: "missing_content" });
    return jsonError("Email body is required", 400, ctx, { code: "MISSING_CONTENT" });
  }

  if (text.length > MAX_CONTENT_LENGTH || html.length > MAX_CONTENT_LENGTH) {
    logApiWarning(ctx, 400, {
      reason: "content_too_large",
      textLength: text.length,
      htmlLength: html.length,
    });
    return jsonError(`Email content cannot exceed ${MAX_CONTENT_LENGTH} characters`, 400, ctx, {
      code: "CONTENT_TOO_LARGE",
    });
  }

  try {
    const health = await getEmailHealthStatus();
    if (!health.canSend) {
      logApiWarning(ctx, 400, {
        reason: "smtp_not_configured",
        missing: health.missing,
      });
      return jsonError("SMTP is not configured", 400, ctx, {
        code: "SMTP_NOT_CONFIGURED",
        missing: health.missing,
      });
    }

    const sentTo: string[] = [];
    const failed: Array<{ email: string; error: string }> = [];

    for (const recipient of recipients) {
      try {
        await sendEmail({
          to: recipient,
          subject,
          text: text || undefined,
          html: html || buildHtmlFromText(text),
        });
        sentTo.push(recipient);
      } catch (error) {
        failed.push({
          email: recipient,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logApiSuccess(ctx, 200, {
      action: "admin_send_email",
      sent: sentTo.length,
      failed: failed.length,
      to: sentTo.map((email) => maskEmail(email)),
    });

    return jsonOk(
      {
        sent: sentTo.length,
        failed: failed.length,
        sentTo,
        failedItems: failed,
      },
      ctx,
    );
  } catch (error) {
    logApiError(ctx, 500, error, { action: "admin_send_email" });
    return jsonError("Failed to send email", 500, ctx, { code: "SEND_EMAIL_FAILED" });
  }
}
