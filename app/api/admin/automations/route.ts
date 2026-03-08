import type { AutomationChannel, AutomationTrigger, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

type Body = {
  name?: string;
  trigger?: AutomationTrigger;
  channel?: AutomationChannel;
  delayMinutes?: number;
  filters?: Prisma.InputJsonValue;
  template?: Prisma.InputJsonValue;
};

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  try {
    const rules = await prisma.automationRule.findMany({
      orderBy: { updatedAt: "desc" },
      include: { logs: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
    logApiSuccess(ctx, 200, { count: rules.length });
    return jsonOk({ rules }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load automations", 500, ctx, { code: "AUTOMATIONS_FETCH_FAILED" });
  }
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  if (!body.name || !body.trigger) {
    logApiWarning(ctx, 400, { reason: "missing_fields" });
    return jsonError("Name and trigger are required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  try {
    const rule = await prisma.automationRule.create({
      data: {
        name: body.name,
        trigger: body.trigger,
        channel: body.channel ?? "EMAIL",
        delayMinutes: body.delayMinutes ?? 0,
        filters: body.filters ?? undefined,
        template: body.template ?? undefined,
      },
    });
    logApiSuccess(ctx, 200, { ruleId: rule.id });
    return jsonOk({ rule }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to create automation", 500, ctx, { code: "AUTOMATION_CREATE_FAILED" });
  }
}
