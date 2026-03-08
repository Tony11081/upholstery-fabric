import type { AutomationChannel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

type Body = {
  name?: string;
  active?: boolean;
  channel?: AutomationChannel;
  delayMinutes?: number;
  filters?: Prisma.InputJsonValue;
  template?: Prisma.InputJsonValue;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  try {
    const rule = await prisma.automationRule.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        active: typeof body.active === "boolean" ? body.active : undefined,
        channel: body.channel ?? undefined,
        delayMinutes: typeof body.delayMinutes === "number" ? body.delayMinutes : undefined,
        filters: body.filters ?? undefined,
        template: body.template ?? undefined,
      },
    });
    logApiSuccess(ctx, 200, { ruleId: rule.id });
    return jsonOk({ rule }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to update automation", 500, ctx, { code: "AUTOMATION_UPDATE_FAILED" });
  }
}
