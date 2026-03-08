import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveVipTier, calculatePoints } from "@/lib/loyalty/vip";

type CustomerIdentity = {
  email: string;
  name?: string | null;
  phone?: string | null;
  source?: string | null;
  utm?: Prisma.InputJsonValue;
};

export async function upsertCustomer(identity: CustomerIdentity) {
  const email = identity.email.trim().toLowerCase();
  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    const customer = await prisma.customer.update({
      where: { email },
      data: {
        name: identity.name ?? existing.name ?? undefined,
        phone: identity.phone ?? existing.phone ?? undefined,
        source: identity.source ?? existing.source ?? undefined,
        utm: identity.utm ?? existing.utm ?? undefined,
        lastSeenAt: new Date(),
      },
    });
    return { customer, created: false };
  }

  const customer = await prisma.customer.create({
    data: {
      email,
      name: identity.name ?? undefined,
      phone: identity.phone ?? undefined,
      source: identity.source ?? undefined,
      utm: identity.utm ?? undefined,
      lastSeenAt: new Date(),
    },
  });
  return { customer, created: true };
}

export async function recordCustomerEvent(payload: {
  email?: string | null;
  customerId?: string | null;
  event: string;
  source?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const email = payload.email?.trim().toLowerCase();
  const customerId = payload.customerId ?? undefined;
  return prisma.customerEvent.create({
    data: {
      email,
      customerId,
      event: payload.event,
      source: payload.source ?? undefined,
      metadata: payload.metadata ?? undefined,
    },
  });
}

export async function applyOrderToCustomer(params: {
  customerId: string;
  orderTotal: number;
  orderCountIncrement?: number;
}) {
  const customer = await prisma.customer.findUnique({
    where: { id: params.customerId },
  });
  if (!customer) return null;
  const orderTotalDecimal = new Prisma.Decimal(params.orderTotal);
  const nextLifetime = customer.lifetimeValue.plus(orderTotalDecimal);
  const tier = await resolveVipTier(nextLifetime);
  const pointsEarned = calculatePoints(orderTotalDecimal, tier);

  return prisma.customer.update({
    where: { id: params.customerId },
    data: {
      lifetimeValue: nextLifetime,
      orderCount: { increment: params.orderCountIncrement ?? 1 },
      lastOrderAt: new Date(),
      vipTierId: tier?.id ?? customer.vipTierId ?? undefined,
      points: { increment: pointsEarned },
    },
  });
}
