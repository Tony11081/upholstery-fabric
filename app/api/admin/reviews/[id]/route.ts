import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { sendEmail } from "@/lib/email";
import { buildCouponEmail } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/utils/site";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

type Body = {
  status?: "APPROVED" | "REJECTED" | "PENDING";
  rewardCouponCode?: string;
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
  if (!body.status) {
    logApiWarning(ctx, 400, { reason: "missing_status" });
    return jsonError("Status is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  try {
    const rewardCode = body.rewardCouponCode?.trim().toUpperCase();
    let coupon = null;
    if (rewardCode) {
      coupon = await prisma.coupon.findUnique({ where: { code: rewardCode } });
      if (!coupon || !coupon.active) {
        logApiWarning(ctx, 400, { reason: "invalid_coupon", rewardCode });
        return jsonError("Coupon not found or inactive", 400, ctx, { code: "COUPON_INVALID" });
      }
    }

    const review = await prisma.review.update({
      where: { id },
      data: {
        status: body.status,
        publishedAt: body.status === "APPROVED" ? new Date() : null,
      },
      include: { product: true, customer: true },
    });
    let rewardSent = false;
    let rewardError: string | null = null;

    if (body.status === "APPROVED" && coupon && rewardCode) {
      const recipient = review.customer?.email ?? null;
      if (!recipient) {
        rewardError = "Reviewer email is missing";
      } else if (review.rewardedAt) {
        rewardError = "Reward already sent";
      } else {
        try {
          if (review.customer?.id) {
            const existingAssignment = await prisma.couponAssignment.findFirst({
              where: { couponId: coupon.id, customerId: review.customer.id },
            });
            if (!existingAssignment) {
              await prisma.couponAssignment.create({
                data: {
                  couponId: coupon.id,
                  customerId: review.customer.id,
                  email: recipient,
                  status: "review_reward",
                  sentAt: new Date(),
                },
              });
            }
          }

          const emailTemplate = buildCouponEmail({
            code: coupon.code,
            description:
              coupon.type === "PERCENTAGE"
                ? `${Number(coupon.amount)}% off your next purchase`
                : `$${Number(coupon.amount).toFixed(2)} off your next purchase`,
            expiresAt: coupon.endsAt?.toISOString() ?? null,
            redeemUrl: getSiteUrl(request.headers.get("origin") ?? undefined),
          });
          await sendEmail({
            to: recipient,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
            text: emailTemplate.text,
          });
          rewardSent = true;
          await prisma.review.update({
            where: { id: review.id },
            data: {
              rewardedAt: new Date(),
              rewardCouponCode: coupon.code,
            },
          });
        } catch (error) {
          rewardError = error instanceof Error ? error.message : "Reward send failed";
        }
      }
    }

    logApiSuccess(ctx, 200, { reviewId: review.id, status: review.status });
    return jsonOk({ review, rewardSent, rewardError }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to update review", 500, ctx, { code: "REVIEW_UPDATE_FAILED" });
  }
}
