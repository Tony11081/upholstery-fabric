import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { upsertCustomer, recordCustomerEvent } from "@/lib/data/customers";
import {
  createApiContext,
  jsonError,
  jsonOk,
  logApiError,
  logApiSuccess,
  logApiWarning,
} from "@/lib/utils/api";
import { sendEmail } from "@/lib/email";
import { buildConsultationConfirmationEmail, buildConsultationInternalEmail } from "@/lib/email/templates";

type RequestBody = {
  name?: string;
  email?: string;
  phone?: string;
  channel?: string;
  preferredAt?: string;
  notes?: string;
  context?: Prisma.InputJsonValue;
};

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email) {
    logApiWarning(ctx, 400, { reason: "missing_email" });
    return jsonError("Email is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  const preferredAt = body.preferredAt ? new Date(body.preferredAt) : null;
  const channel = body.channel?.toUpperCase();
  const context = body.context ?? undefined;
  const contextObject =
    context && typeof context === "object" && !Array.isArray(context) ? (context as Prisma.JsonObject) : undefined;
  const utm = contextObject?.utm as Prisma.InputJsonValue | undefined;

  try {
    const { customer } = await upsertCustomer({
      email,
      name: body.name ?? null,
      phone: body.phone ?? null,
      source: "concierge",
      utm,
    });

    const requestRecord = await prisma.consultationRequest.create({
      data: {
        customerId: customer.id,
        name: body.name ?? null,
        email,
        phone: body.phone ?? null,
        channel: channel ?? null,
        preferredAt: preferredAt && !Number.isNaN(preferredAt.getTime()) ? preferredAt : null,
        notes: body.notes ?? null,
        metadata: context ?? undefined,
      },
    });

    await recordCustomerEvent({
      customerId: customer.id,
      email,
      event: "concierge_request",
      source: "concierge",
      metadata: {
        requestId: requestRecord.id,
        channel: requestRecord.channel,
        preferredAt: requestRecord.preferredAt?.toISOString(),
        context: context ?? null,
      },
    });

    const supportEmail =
      process.env.SUPPORT_EMAIL ??
      process.env.NEXT_PUBLIC_CONCIERGE_EMAIL ??
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

    const internalEmail = buildConsultationInternalEmail({
      requestId: requestRecord.id,
      name: requestRecord.name,
      email,
      phone: requestRecord.phone,
      channel: requestRecord.channel,
      preferredAt: requestRecord.preferredAt?.toISOString(),
      notes: requestRecord.notes,
      context: context ?? null,
    });

    if (supportEmail) {
      try {
        await sendEmail({
          to: supportEmail,
          subject: internalEmail.subject,
          html: internalEmail.html,
          text: internalEmail.text,
        });
      } catch (error) {
        logApiError(ctx, 500, error, { reason: "concierge_internal_email_failed" });
      }
    }

    const confirmation = buildConsultationConfirmationEmail({
      name: requestRecord.name,
      email,
      channel: requestRecord.channel,
      preferredAt: requestRecord.preferredAt?.toISOString(),
    });
    try {
      await sendEmail({
        to: email,
        subject: confirmation.subject,
        html: confirmation.html,
        text: confirmation.text,
      });
    } catch (error) {
      logApiError(ctx, 500, error, { reason: "concierge_confirmation_email_failed" });
    }

    logApiSuccess(ctx, 200, { requestId: requestRecord.id });
    return jsonOk({ requestId: requestRecord.id }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to submit consultation request", 500, ctx, {
      code: "CONSULTATION_REQUEST_FAILED",
    });
  }
}
