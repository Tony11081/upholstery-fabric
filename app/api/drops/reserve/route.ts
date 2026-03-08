import { prisma } from "@/lib/prisma";
import { scheduleAutomations } from "@/lib/automation/engine";
import { recordCustomerEvent, upsertCustomer } from "@/lib/data/customers";
import {
  createApiContext,
  jsonError,
  jsonOk,
  logApiError,
  logApiSuccess,
  logApiWarning,
  maskEmail,
} from "@/lib/utils/api";

type Body = {
  contentId?: string;
  slug?: string;
  email?: string;
  name?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    logApiWarning(ctx, 400, { reason: "invalid_email" });
    return jsonError("Valid email is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  try {
    const content = body.contentId
      ? await prisma.contentPost.findUnique({ where: { id: body.contentId } })
      : await prisma.contentPost.findUnique({ where: { slug: body.slug ?? "" } });
    if (!content) {
      logApiWarning(ctx, 404, { reason: "content_not_found" });
      return jsonError("Drop not found", 404, ctx, { code: "NOT_FOUND" });
    }

    const { customer } = await upsertCustomer({ email, name: body.name });
    const existing = await prisma.dropReservation.findFirst({
      where: { contentId: content.id, email },
    });
    if (existing) {
      logApiSuccess(ctx, 200, { reused: true });
      return jsonOk({ reservation: existing }, ctx);
    }

    const reservation = await prisma.dropReservation.create({
      data: {
        contentId: content.id,
        email,
        customerId: customer.id,
      },
    });

    await recordCustomerEvent({
      customerId: customer.id,
      email,
      event: "drop_reservation",
      source: "editorial",
      metadata: { contentId: content.id, slug: content.slug },
    });

    await scheduleAutomations("VIP_DROP", {
      customerId: customer.id,
      email,
      metadata: { contentId: content.id, slug: content.slug, title: content.title },
    });

    logApiSuccess(ctx, 200, { contentId: content.id, email: maskEmail(email) });
    return jsonOk({ reservation }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { email: maskEmail(email) });
    return jsonError("Unable to reserve drop", 500, ctx, { code: "DROP_RESERVE_FAILED" });
  }
}
