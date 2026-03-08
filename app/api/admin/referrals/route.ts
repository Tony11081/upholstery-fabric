import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning, maskEmail } from "@/lib/utils/api";

type Body = {
  email?: string;
  rewardType?: "CREDIT" | "PERCENTAGE" | "FIXED_AMOUNT";
  rewardValue?: number;
};

function generateCode() {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `NEWUOOTD-${suffix}`;
}

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  try {
    const codes = await prisma.referralCode.findMany({
      include: { customer: true, referrals: true },
      orderBy: { createdAt: "desc" },
    });
    logApiSuccess(ctx, 200, { count: codes.length });
    return jsonOk({ codes }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load referrals", 500, ctx, { code: "REFERRAL_FETCH_FAILED" });
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

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    logApiWarning(ctx, 400, { reason: "missing_email" });
    return jsonError("Email is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  try {
    const customer = await prisma.customer.upsert({
      where: { email },
      create: { email },
      update: {},
    });

    const existing = await prisma.referralCode.findFirst({ where: { customerId: customer.id } });
    if (existing) {
      logApiSuccess(ctx, 200, { codeId: existing.id, reused: true });
      return jsonOk({ code: existing }, ctx);
    }

    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      const exists = await prisma.referralCode.findUnique({ where: { code } });
      if (!exists) break;
      code = generateCode();
      attempts += 1;
    }

    const created = await prisma.referralCode.create({
      data: {
        customerId: customer.id,
        code,
        active: true,
        rewardType: body.rewardType ?? "CREDIT",
        rewardValue: new Prisma.Decimal(body.rewardValue ?? 0),
      },
    });

    logApiSuccess(ctx, 200, { codeId: created.id, email: maskEmail(email) });
    return jsonOk({ code: created }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { email: maskEmail(email) });
    return jsonError("Unable to create referral code", 500, ctx, { code: "REFERRAL_CREATE_FAILED" });
  }
}
