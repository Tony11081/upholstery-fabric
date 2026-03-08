import { randomUUID } from "crypto";
import type { AutomationTrigger, Prisma } from "@prisma/client";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";
import { recordCustomerEvent, upsertCustomer } from "@/lib/data/customers";
import { scheduleAutomations } from "@/lib/automation/engine";

const triggerMap: Partial<Record<string, AutomationTrigger>> = {
  welcome: "WELCOME",
  signup: "WELCOME",
  product_view: "BROWSE_ABANDONED",
  add_to_bag: "CART_ABANDONED",
  checkout_started: "PAYMENT_ABANDONED",
  back_in_stock: "BACK_IN_STOCK",
  price_drop: "PRICE_DROP",
  new_arrival: "NEW_ARRIVAL",
  vip_drop: "VIP_DROP",
};

type Body = {
  event?: string;
  email?: string;
  source?: string;
  metadata?: Prisma.InputJsonValue;
};

const mergeMetadata = (metadata: Prisma.InputJsonValue | undefined, visitorId: string) => {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>), visitorId };
  }
  return { visitorId, value: metadata ?? null };
};

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/uootd_vid=([^;]+)/);
  const visitorId = match?.[1] ?? randomUUID();
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx);
  }

  const event = body.event?.trim();
  if (!event) {
    logApiWarning(ctx, 400, { reason: "missing_event" });
    return jsonError("Event name is required", 400, ctx);
  }

  try {
    let customerId: string | undefined;
    if (body.email) {
      const { customer } = await upsertCustomer({ email: body.email });
      customerId = customer.id;
    }

    const eventMetadata = mergeMetadata(body.metadata, visitorId);
    await recordCustomerEvent({
      customerId,
      email: body.email,
      event,
      source: body.source ?? "web",
      metadata: eventMetadata,
    });

    const trigger = triggerMap[event];
    if (trigger && (customerId || body.email)) {
      await scheduleAutomations(trigger, {
        customerId,
        email: body.email,
        metadata: eventMetadata,
      });
    }

    const response = jsonOk({ ok: true }, ctx);
    response.headers.append(
      "Set-Cookie",
      `uootd_vid=${visitorId}; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
    logApiSuccess(ctx, 200, { event, visitorId });
    return response;
  } catch (error) {
    logApiError(ctx, 500, error, { event });
    return jsonError("Unable to record event", 500, ctx);
  }
}
