import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { sendEmail } from "@/lib/email";
import { buildCouponEmail } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/utils/site";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning, maskEmail } from "@/lib/utils/api";

type Body = {
  couponId?: string;
  emails?: string[];
  segment?: string;
  tag?: string;
};

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

  if (!body.couponId) {
    logApiWarning(ctx, 400, { reason: "missing_coupon" });
    return jsonError("Coupon ID is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  try {
    const coupon = await prisma.coupon.findUnique({ where: { id: body.couponId } });
    if (!coupon) {
      logApiWarning(ctx, 404, { couponId: body.couponId });
      return jsonError("Coupon not found", 404, ctx, { code: "COUPON_NOT_FOUND" });
    }

    let targetEmails = (body.emails ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean);
    if (!targetEmails.length) {
      const customers = await prisma.customer.findMany({
        where: {
          ...(body.segment ? { segment: body.segment } : {}),
          ...(body.tag ? { tags: { has: body.tag } } : {}),
        },
      });
      targetEmails = customers.map((customer) => customer.email);
    }

    if (!targetEmails.length) {
      logApiWarning(ctx, 400, { reason: "no_targets" });
      return jsonError("No customers matched", 400, ctx, { code: "NO_TARGETS" });
    }

    let sent = 0;
    for (const email of targetEmails) {
      const customer = await prisma.customer.upsert({
        where: { email },
        create: { email },
        update: {},
      });
      const existing = await prisma.couponAssignment.findFirst({
        where: { couponId: coupon.id, customerId: customer.id },
      });
      if (existing) continue;
      await prisma.couponAssignment.create({
        data: {
          couponId: coupon.id,
          customerId: customer.id,
          email,
          status: "sent",
          sentAt: new Date(),
        },
      });
      const emailTemplate = buildCouponEmail({
        code: coupon.code,
        description:
          coupon.type === "PERCENTAGE"
            ? `${Number(coupon.amount)}% off selected pieces`
            : `$${Number(coupon.amount).toFixed(2)} off selected pieces`,
        expiresAt: coupon.endsAt?.toISOString() ?? null,
        redeemUrl: getSiteUrl(),
      });
      try {
        await sendEmail({
          to: email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
        });
        sent += 1;
      } catch (error) {
        logApiWarning(ctx, 500, { email: maskEmail(email), message: error instanceof Error ? error.message : String(error) });
      }
    }

    logApiSuccess(ctx, 200, { sent });
    return jsonOk({ sent }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to assign coupon", 500, ctx, { code: "COUPON_ASSIGN_FAILED" });
  }
}

