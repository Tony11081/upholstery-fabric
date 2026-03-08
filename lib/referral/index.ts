import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function attachReferralToOrder(params: {
  referralCode?: string | null;
  orderId: string;
  referredCustomerId?: string | null;
  referredEmail?: string | null;
}) {
  const code = params.referralCode?.trim();
  if (!code) return null;

  const referralCode = await prisma.referralCode.findUnique({
    where: { code },
  });
  if (!referralCode || !referralCode.active) return null;

  const existing = await prisma.referral.findFirst({
    where: { orderId: params.orderId },
  });
  if (existing) return existing;

  return prisma.referral.create({
    data: {
      referralCodeId: referralCode.id,
      referrerCustomerId: referralCode.customerId,
      referredCustomerId: params.referredCustomerId ?? null,
      referredEmail: params.referredEmail ?? null,
      orderId: params.orderId,
      status: "PENDING",
      rewardAmount: new Prisma.Decimal(0),
    },
  });
}

