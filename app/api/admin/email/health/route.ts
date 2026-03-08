import { getAdminSession, parseAdminEmails } from "@/lib/auth/admin";
import { isOpenClawAdminRequest } from "@/lib/auth/openclaw-admin";
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

type TestEmailRequestBody = {
  to?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolveDefaultRecipient(sessionEmail?: string | null) {
  if (sessionEmail?.trim()) return sessionEmail.trim();
  if (process.env.SUPPORT_EMAIL?.trim()) return process.env.SUPPORT_EMAIL.trim();
  return parseAdminEmails()[0] ?? "";
}

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();

  const openclawAuthorized = isOpenClawAdminRequest(request);
  if (!session && !openclawAuthorized) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  try {
    const health = await getEmailHealthStatus();
    const recommendedRecipient = resolveDefaultRecipient(session?.user?.email);
    logApiSuccess(ctx, 200, {
      configured: health.configured,
      verified: health.verified,
      recommendedRecipient: maskEmail(recommendedRecipient),
    });
    return jsonOk(
      {
        health,
        recommendedRecipient,
      },
      ctx,
    );
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to check email health", 500, ctx, {
      code: "EMAIL_HEALTH_FAILED",
    });
  }
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();

  const openclawAuthorized = isOpenClawAdminRequest(request);
  if (!session) {
    if (openclawAuthorized) {
      logApiWarning(ctx, 403, { authorized: false, reason: "openclaw_readonly" });
      return jsonError("Forbidden", 403, ctx, { code: "FORBIDDEN" });
    }
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  let body: TestEmailRequestBody;
  try {
    body = (await request.json()) as TestEmailRequestBody;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, {
      code: "INVALID_BODY",
    });
  }

  const recipient = (body.to?.trim() || resolveDefaultRecipient(session.user?.email)).toLowerCase();
  if (!recipient) {
    logApiWarning(ctx, 400, { reason: "missing_recipient" });
    return jsonError("Recipient email is required", 400, ctx, {
      code: "MISSING_RECIPIENT",
    });
  }

  if (!EMAIL_REGEX.test(recipient)) {
    logApiWarning(ctx, 400, { reason: "invalid_recipient", recipient: maskEmail(recipient) });
    return jsonError("Recipient email format is invalid", 400, ctx, {
      code: "INVALID_RECIPIENT",
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

    const now = new Date();
    const timestamp = now.toISOString();
    await sendEmail({
      to: recipient,
      subject: `[UOOTD] SMTP test ${timestamp}`,
      text: [
        "SMTP test email from UOOTD admin.",
        `Time: ${timestamp}`,
        `Request ID: ${ctx.requestId}`,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111;">
          <h2 style="margin:0 0 8px;">SMTP test email</h2>
          <p style="margin:0 0 8px;">This message confirms outbound email is working.</p>
          <p style="margin:0;"><strong>Time:</strong> ${timestamp}</p>
          <p style="margin:0;"><strong>Request ID:</strong> ${ctx.requestId}</p>
        </div>
      `,
    });

    logApiSuccess(ctx, 200, {
      action: "send_test_email",
      to: maskEmail(recipient),
      verified: health.verified,
    });
    return jsonOk(
      {
        sent: true,
        to: recipient,
        health,
      },
      ctx,
    );
  } catch (error) {
    logApiError(ctx, 500, error, {
      action: "send_test_email",
      to: maskEmail(recipient),
    });
    return jsonError("Failed to send test email", 500, ctx, {
      code: "TEST_EMAIL_FAILED",
    });
  }
}
