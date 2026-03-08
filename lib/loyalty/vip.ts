import { Prisma, type VipTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function resolveVipTier(totalSpend: Prisma.Decimal): Promise<VipTier | null> {
  const tiers = await prisma.vipTier.findMany({ orderBy: { level: "asc" } });
  if (tiers.length === 0) return null;
  let chosen: VipTier | null = null;
  for (const tier of tiers) {
    if (totalSpend.gte(tier.minSpend)) {
      chosen = tier;
    }
  }
  return chosen;
}

export function calculatePoints(total: Prisma.Decimal, tier: VipTier | null): number {
  if (!tier) return Math.floor(Number(total));
  const multiplier = Number(tier.pointsPerDollar);
  return Math.max(0, Math.floor(Number(total) * multiplier));
}
