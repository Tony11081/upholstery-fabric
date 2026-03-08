import type { AutomationRule, AutomationTrigger, Customer, Prisma } from "@prisma/client";
import { AutomationChannel, AutomationLogStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications/send";

type AutomationContext = {
  customerId?: string | null;
  email?: string | null;
  metadata?: Prisma.InputJsonValue;
};

type AutomationFilters = {
  tags?: string[];
  segment?: string[];
  vipTierIds?: string[];
  minLifetimeValue?: number;
  minOrderCount?: number;
};

function matchesFilters(filters: AutomationFilters | null, customer: Customer | null) {
  if (!filters) return true;
  if (!customer) return false;
  if (filters.segment?.length && (!customer.segment || !filters.segment.includes(customer.segment))) {
    return false;
  }
  if (filters.vipTierIds?.length && (!customer.vipTierId || !filters.vipTierIds.includes(customer.vipTierId))) {
    return false;
  }
  if (filters.tags?.length) {
    const hasTag = filters.tags.some((tag) => customer.tags.includes(tag));
    if (!hasTag) return false;
  }
  if (typeof filters.minLifetimeValue === "number") {
    if (Number(customer.lifetimeValue) < filters.minLifetimeValue) return false;
  }
  if (typeof filters.minOrderCount === "number") {
    if (customer.orderCount < filters.minOrderCount) return false;
  }
  return true;
}

function interpolate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? "");
}

function buildEmailTemplate(rule: AutomationRule, customer: Customer | null) {
  const template = (rule.template ?? {}) as Record<string, string>;
  const subject = template.subject ?? rule.name;
  const headline = template.headline ?? rule.name;
  const body = template.body ?? "We have an update from UOOTD.";
  const ctaLabel = template.ctaLabel ?? "View now";
  const ctaUrl = template.ctaUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? "/";
  const values = {
    name: customer?.name ?? "Client",
  };

  return {
    subject: interpolate(subject, values),
    html: `
      <div style="font-family: Inter, Arial, sans-serif; color:#2f2a26; line-height:1.5;">
        <h2 style="font-family: 'Playfair Display', serif; font-size:24px; margin:0 0 12px;">${interpolate(
          headline,
          values,
        )}</h2>
        <p style="margin:0 0 18px;">${interpolate(body, values)}</p>
        <p style="margin:0 0 24px;">
          <a href="${ctaUrl}" style="display:inline-block;padding:10px 18px;border-radius:999px;border:1px solid #d9c6a3;color:#2f2a26;text-decoration:none;">
            ${ctaLabel}
          </a>
        </p>
        <p style="font-size:12px;color:#7c746e;">If you have questions, reply to this email.</p>
      </div>
    `,
    text: `${interpolate(headline, values)}\n\n${interpolate(body, values)}\n\n${ctaLabel}: ${ctaUrl}`,
  };
}

export async function scheduleAutomations(trigger: AutomationTrigger, context: AutomationContext) {
  const rules = await prisma.automationRule.findMany({
    where: { trigger, active: true },
  });

  let customer: Customer | null = null;
  if (context.customerId) {
    customer = await prisma.customer.findUnique({ where: { id: context.customerId } });
  } else if (context.email) {
    customer = await prisma.customer.findUnique({ where: { email: context.email.trim().toLowerCase() } });
  }

  const scheduled: string[] = [];
  for (const rule of rules) {
    const filters = (rule.filters ?? null) as AutomationFilters | null;
    if (!matchesFilters(filters, customer)) continue;
    const delayMinutes = rule.delayMinutes ?? 0;
    const scheduledFor =
      delayMinutes > 0 ? new Date(Date.now() + delayMinutes * 60 * 1000) : null;
    const email = context.email ?? customer?.email ?? null;
    await prisma.automationLog.create({
      data: {
        ruleId: rule.id,
        customerId: customer?.id ?? null,
        email: email ?? undefined,
        channel: rule.channel,
        status: AutomationLogStatus.PENDING,
        scheduledFor: scheduledFor ?? undefined,
        payload: context.metadata ?? undefined,
      },
    });
    scheduled.push(rule.id);
  }

  return scheduled;
}

export async function dispatchPendingAutomations(limit = 20) {
  const now = new Date();
  const logs = await prisma.automationLog.findMany({
    where: {
      status: AutomationLogStatus.PENDING,
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    include: { rule: true, customer: true },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  for (const log of logs) {
    try {
      const to = log.email ?? log.customer?.email;
      if (!to) {
        throw new Error("Recipient email is missing");
      }

      if (log.rule.channel === AutomationChannel.EMAIL) {
        const emailPayload = buildEmailTemplate(log.rule, log.customer ?? null);
        await sendNotification({
          channel: AutomationChannel.EMAIL,
          to,
          subject: emailPayload.subject,
          html: emailPayload.html,
          text: emailPayload.text,
        });
      } else {
        await sendNotification({
          channel: log.rule.channel,
          to,
          text: log.rule.name,
        });
      }

      await prisma.automationLog.update({
        where: { id: log.id },
        data: { status: AutomationLogStatus.SENT, sentAt: new Date() },
      });
    } catch (error) {
      await prisma.automationLog.update({
        where: { id: log.id },
        data: {
          status: AutomationLogStatus.FAILED,
          error: error instanceof Error ? error.message : "Delivery failed",
        },
      });
    }
  }
}
