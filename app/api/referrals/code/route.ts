import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";
import { upsertCustomer } from "@/lib/data/customers";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

function generateCode() {
  return `UOOTD-${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function createReferralCode(customerId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();
    try {
      return await prisma.referralCode.create({
        data: {
          customerId,
          code,
          rewardType: "CREDIT",
          rewardValue: 20,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unique")) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unable to generate unique referral code");
}

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAuthSession();
  if (!session?.user?.email) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  try {
    const { customer } = await upsertCustomer({ email: session.user.email, name: session.user.name ?? undefined });
    const code = await prisma.referralCode.findFirst({
      where: { customerId: customer.id, active: true },
      orderBy: { createdAt: "desc" },
    });
    logApiSuccess(ctx, 200, { hasCode: Boolean(code) });
    return jsonOk({ code }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load referral code", 500, ctx, { code: "REFERRAL_FETCH_FAILED" });
  }
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAuthSession();
  if (!session?.user?.email) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  try {
    const { customer } = await upsertCustomer({ email: session.user.email, name: session.user.name ?? undefined });
    const existing = await prisma.referralCode.findFirst({
      where: { customerId: customer.id, active: true },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      logApiSuccess(ctx, 200, { reused: true });
      return jsonOk({ code: existing }, ctx);
    }

    const code = await createReferralCode(customer.id);
    logApiSuccess(ctx, 201, { id: code.id });
    return jsonOk({ code }, ctx, { status: 201 });
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to create referral code", 500, ctx, { code: "REFERRAL_CREATE_FAILED" });
  }
}
