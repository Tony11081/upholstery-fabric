import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";
import { Prisma } from "@prisma/client";

type Body = {
  name?: string;
  level?: number;
  minSpend?: number;
  pointsPerDollar?: number;
  birthdayGift?: string;
  earlyAccessDays?: number;
  supportChannel?: string;
};

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  try {
    const tiers = await prisma.vipTier.findMany({ orderBy: { level: "asc" } });
    logApiSuccess(ctx, 200, { count: tiers.length });
    return jsonOk({ tiers }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load VIP tiers", 500, ctx, { code: "VIP_FETCH_FAILED" });
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

  if (!body.name || typeof body.level !== "number") {
    logApiWarning(ctx, 400, { reason: "missing_fields" });
    return jsonError("Name and level are required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  try {
    const tier = await prisma.vipTier.create({
      data: {
        name: body.name,
        level: body.level,
        minSpend: new Prisma.Decimal(body.minSpend ?? 0),
        pointsPerDollar: new Prisma.Decimal(body.pointsPerDollar ?? 1),
        birthdayGift: body.birthdayGift ?? null,
        earlyAccessDays: body.earlyAccessDays ?? 0,
        supportChannel: body.supportChannel ?? null,
      },
    });
    logApiSuccess(ctx, 200, { tierId: tier.id });
    return jsonOk({ tier }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to create VIP tier", 500, ctx, { code: "VIP_CREATE_FAILED" });
  }
}

