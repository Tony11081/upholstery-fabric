import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { isOpenClawAdminRequest } from "@/lib/auth/openclaw-admin";
import { getPaymentLinkMetricsSnapshot } from "@/lib/inflyway/payment-link-metrics";
import {
  createApiContext,
  jsonError,
  jsonOk,
  logApiError,
  logApiSuccess,
  logApiWarning,
} from "@/lib/utils/api";

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  const openclawAuthorized = isOpenClawAdminRequest(request);
  if (!session && !openclawAuthorized) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  const now = new Date();
  const toDateKey = (date: Date) => date.toISOString().slice(0, 10);
  const toLabel = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const startOfDay = (date: Date) => {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };
  const startOfWeek = (date: Date) => {
    const copy = startOfDay(date);
    const day = (copy.getDay() + 6) % 7;
    copy.setDate(copy.getDate() - day);
    return copy;
  };
  const dailyRange = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (13 - index));
    return startOfDay(date);
  });
  const weeklyRange = Array.from({ length: 12 }, (_, index) => {
    const date = startOfWeek(now);
    date.setDate(date.getDate() - (11 - index) * 7);
    return date;
  });

  try {
    const [
      customerCount,
      orderCount,
      revenueAgg,
      avgLtvAgg,
      repeatCount,
      segmentStats,
      sourceStats,
      viewEvents,
      bagEvents,
      checkoutEvents,
      addressReviewEvents,
      paymentLinkRequestedEvents,
      paymentLinkCreatedEvents,
      paymentRedirectAttemptEvents,
      paymentRedirectFailedEvents,
      paymentLinkRequestFailedEvents,
      requestEvents,
      paidOrderCount,
      pageViewEvents,
      uniqueVisitorRows,
      pageViewDailyRows,
      orderDailyRows,
      pageViewWeeklyRows,
      orderWeeklyRows,
      customers,
      aiStatusStats,
      ai24hStats,
      aiTopErrors,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.order.count({ where: { status: { notIn: ["CANCELED", "RETURNED"] } } }),
      prisma.order.aggregate({
        where: { status: { notIn: ["CANCELED", "RETURNED"] } },
        _sum: { total: true },
      }),
      prisma.customer.aggregate({ _avg: { lifetimeValue: true } }),
      prisma.customer.count({ where: { orderCount: { gte: 2 } } }),
      prisma.customer.groupBy({
        by: ["segment"],
        _count: { _all: true },
        orderBy: { _count: { segment: "desc" } },
      }),
      prisma.customer.groupBy({
        by: ["source"],
        _count: { _all: true },
        orderBy: { _count: { source: "desc" } },
      }),
      prisma.customerEvent.count({ where: { event: "product_view" } }),
      prisma.customerEvent.count({ where: { event: "add_to_bag" } }),
      prisma.customerEvent.count({ where: { event: "checkout_started" } }),
      prisma.customerEvent.count({ where: { event: "checkout_address_review_opened" } }),
      prisma.customerEvent.count({ where: { event: "payment_link_requested" } }),
      prisma.customerEvent.count({ where: { event: "payment_link_created" } }),
      prisma.customerEvent.count({ where: { event: "payment_redirect_attempted" } }),
      prisma.customerEvent.count({ where: { event: "payment_redirect_failed" } }),
      prisma.customerEvent.count({ where: { event: "payment_link_request_failed" } }),
      prisma.customerEvent.count({ where: { event: "purchase_request" } }),
      prisma.order.count({
        where: {
          status: { in: ["CONFIRMED", "SHIPPED", "DELIVERED"] },
        },
      }),
      prisma.customerEvent.count({ where: { event: "page_view" } }),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT (metadata->>'visitorId')) AS count
        FROM "CustomerEvent"
        WHERE event = 'page_view' AND metadata->>'visitorId' IS NOT NULL
      `,
      prisma.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT date_trunc('day', "occurredAt") AS day, COUNT(*) AS count
        FROM "CustomerEvent"
        WHERE event = 'page_view' AND "occurredAt" >= ${dailyRange[0]}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count
        FROM "Order"
        WHERE "createdAt" >= ${dailyRange[0]}
          AND status NOT IN ('CANCELED', 'RETURNED')
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<{ week: Date; count: bigint }[]>`
        SELECT date_trunc('week', "occurredAt") AS week, COUNT(*) AS count
        FROM "CustomerEvent"
        WHERE event = 'page_view' AND "occurredAt" >= ${weeklyRange[0]}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<{ week: Date; count: bigint }[]>`
        SELECT date_trunc('week', "createdAt") AS week, COUNT(*) AS count
        FROM "Order"
        WHERE "createdAt" >= ${weeklyRange[0]}
          AND status NOT IN ('CANCELED', 'RETURNED')
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.customer.findMany({
        select: {
          lastOrderAt: true,
          lastSeenAt: true,
          orderCount: true,
          lifetimeValue: true,
          utm: true,
        },
      }),
      prisma.aiBridgeJob.groupBy({
        by: ["status"],
        where: { type: "PRODUCT_OPTIMIZATION" },
        _count: { _all: true },
      }),
      prisma.aiBridgeJob.groupBy({
        by: ["status"],
        where: {
          type: "PRODUCT_OPTIMIZATION",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        _count: { _all: true },
      }),
      prisma.$queryRaw<Array<{ error: string | null; count: bigint }>>`
        SELECT COALESCE(error, 'Unknown error') AS error, COUNT(*) AS count
        FROM "AiBridgeJob"
        WHERE type = 'PRODUCT_OPTIMIZATION'
          AND status = 'FAILED'
          AND "updatedAt" >= NOW() - INTERVAL '24 HOURS'
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 5
      `,
    ]);

    const revenue = Number(revenueAgg._sum.total ?? 0);
    const avgOrderValue = orderCount > 0 ? Number((revenue / orderCount).toFixed(2)) : 0;
    const repeatRate = customerCount > 0 ? Number(((repeatCount / customerCount) * 100).toFixed(1)) : 0;
    const viewToBagRate = viewEvents > 0 ? Number(((bagEvents / viewEvents) * 100).toFixed(1)) : 0;
    const bagToCheckoutRate = bagEvents > 0 ? Number(((checkoutEvents / bagEvents) * 100).toFixed(1)) : 0;
    const checkoutToOrderRate = checkoutEvents > 0 ? Number(((orderCount / checkoutEvents) * 100).toFixed(1)) : 0;
    const toRate = (numerator: number, denominator: number) =>
      denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;
    const reviewToLinkRate = toRate(paymentLinkCreatedEvents, addressReviewEvents);
    const requestToLinkRate = toRate(paymentLinkCreatedEvents, paymentLinkRequestedEvents);
    const linkToRedirectRate = toRate(paymentRedirectAttemptEvents, paymentLinkCreatedEvents);
    const redirectFailureRate = toRate(paymentRedirectFailedEvents, paymentRedirectAttemptEvents);
    const requestFailureRate = toRate(paymentLinkRequestFailedEvents, paymentLinkRequestedEvents);
    const linkToPaidRate = toRate(paidOrderCount, paymentLinkCreatedEvents);
    const uniqueVisitors = Number(uniqueVisitorRows?.[0]?.count ?? 0);
    const paymentLinkMetrics = getPaymentLinkMetricsSnapshot();
    const aiOptimization = {
      totals: {
        pending: 0,
        inProgress: 0,
        done: 0,
        failed: 0,
      },
      last24h: {
        queued: 0,
        done: 0,
        failed: 0,
        successRate: 0,
      },
      topErrors: aiTopErrors.map((row) => ({
        error: row.error || "Unknown error",
        count: Number(row.count),
      })),
    };
    aiStatusStats.forEach((row) => {
      if (row.status === "PENDING") aiOptimization.totals.pending = row._count._all;
      if (row.status === "IN_PROGRESS") aiOptimization.totals.inProgress = row._count._all;
      if (row.status === "DONE") aiOptimization.totals.done = row._count._all;
      if (row.status === "FAILED") aiOptimization.totals.failed = row._count._all;
    });
    ai24hStats.forEach((row) => {
      if (row.status === "PENDING") aiOptimization.last24h.queued = row._count._all;
      if (row.status === "DONE") aiOptimization.last24h.done = row._count._all;
      if (row.status === "FAILED") aiOptimization.last24h.failed = row._count._all;
    });
    const aiCompleted24h = aiOptimization.last24h.done + aiOptimization.last24h.failed;
    aiOptimization.last24h.successRate =
      aiCompleted24h > 0
        ? Number(((aiOptimization.last24h.done / aiCompleted24h) * 100).toFixed(1))
        : 0;

    const alerts: Array<{
      id: string;
      level: "warning" | "critical";
      title: string;
      detail: string;
    }> = [];
    if (paymentLinkMetrics.api.recentSuccessRate < 95) {
      alerts.push({
        id: "payment-link-recent-success",
        level: paymentLinkMetrics.api.recentSuccessRate < 85 ? "critical" : "warning",
        title: "Payment link success rate dropped",
        detail: `Recent API success is ${paymentLinkMetrics.api.recentSuccessRate}% (target >= 95%).`,
      });
    }
    if (requestFailureRate >= 5) {
      alerts.push({
        id: "payment-link-request-failure",
        level: requestFailureRate >= 10 ? "critical" : "warning",
        title: "Payment link request failures increased",
        detail: `Request failure rate is ${requestFailureRate}% (target < 5%).`,
      });
    }
    if (aiCompleted24h > 0 && aiOptimization.last24h.successRate < 85) {
      alerts.push({
        id: "ai-optimization-success-rate",
        level: aiOptimization.last24h.successRate < 70 ? "critical" : "warning",
        title: "AI optimization success rate dropped",
        detail: `Last 24h success is ${aiOptimization.last24h.successRate}% (target >= 85%).`,
      });
    }
    if (aiOptimization.last24h.failed >= 10) {
      alerts.push({
        id: "ai-optimization-failures",
        level: aiOptimization.last24h.failed >= 30 ? "critical" : "warning",
        title: "AI optimization failures accumulating",
        detail: `Last 24h failed jobs: ${aiOptimization.last24h.failed}.`,
      });
    }

    const dailyPageViewMap = new Map<string, number>();
    pageViewDailyRows.forEach((row) => {
      dailyPageViewMap.set(toDateKey(row.day), Number(row.count));
    });
    const dailyOrderMap = new Map<string, number>();
    orderDailyRows.forEach((row) => {
      dailyOrderMap.set(toDateKey(row.day), Number(row.count));
    });
    const weeklyPageViewMap = new Map<string, number>();
    pageViewWeeklyRows.forEach((row) => {
      weeklyPageViewMap.set(toDateKey(row.week), Number(row.count));
    });
    const weeklyOrderMap = new Map<string, number>();
    orderWeeklyRows.forEach((row) => {
      weeklyOrderMap.set(toDateKey(row.week), Number(row.count));
    });

    const recencyBuckets = { "0-30d": 0, "31-90d": 0, "90d+": 0 } as Record<string, number>;
    const frequencyBuckets = { "0": 0, "1-2": 0, "3-5": 0, "6+": 0 } as Record<string, number>;
    const monetaryBuckets = { "0-499": 0, "500-1999": 0, "2000+": 0 } as Record<string, number>;
    const orderBuckets = { "0": 0, "1": 0, "2-3": 0, "4-5": 0, "6+": 0 } as Record<string, number>;
    const repeatBuckets = { "No order": 0, "One-time": 0, "Repeat (2+)": 0 } as Record<string, number>;
    const ltvBuckets = { "0-199": 0, "200-999": 0, "1000-2999": 0, "3000+": 0 } as Record<string, number>;
    const utmSourceMap = new Map<string, number>();
    const utmCampaignMap = new Map<string, number>();

    const now = new Date();
    customers.forEach((customer) => {
      const lastTouch = customer.lastOrderAt ?? customer.lastSeenAt;
      if (lastTouch) {
        const days = Math.floor((now.getTime() - lastTouch.getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 30) recencyBuckets["0-30d"] += 1;
        else if (days <= 90) recencyBuckets["31-90d"] += 1;
        else recencyBuckets["90d+"] += 1;
      }

      const orders = customer.orderCount ?? 0;
      if (orders === 0) frequencyBuckets["0"] += 1;
      else if (orders <= 2) frequencyBuckets["1-2"] += 1;
      else if (orders <= 5) frequencyBuckets["3-5"] += 1;
      else frequencyBuckets["6+"] += 1;

      if (orders === 0) orderBuckets["0"] += 1;
      else if (orders === 1) orderBuckets["1"] += 1;
      else if (orders <= 3) orderBuckets["2-3"] += 1;
      else if (orders <= 5) orderBuckets["4-5"] += 1;
      else orderBuckets["6+"] += 1;

      if (orders === 0) repeatBuckets["No order"] += 1;
      else if (orders === 1) repeatBuckets["One-time"] += 1;
      else repeatBuckets["Repeat (2+)"] += 1;

      const ltv = Number(customer.lifetimeValue ?? 0);
      if (ltv < 500) monetaryBuckets["0-499"] += 1;
      else if (ltv < 2000) monetaryBuckets["500-1999"] += 1;
      else monetaryBuckets["2000+"] += 1;

      if (ltv < 200) ltvBuckets["0-199"] += 1;
      else if (ltv < 1000) ltvBuckets["200-999"] += 1;
      else if (ltv < 3000) ltvBuckets["1000-2999"] += 1;
      else ltvBuckets["3000+"] += 1;

      const utm = customer.utm as Record<string, string> | null;
      if (utm) {
        const source = utm.utm_source ?? utm.source;
        const campaign = utm.utm_campaign ?? utm.campaign;
        if (source) utmSourceMap.set(source, (utmSourceMap.get(source) ?? 0) + 1);
        if (campaign) utmCampaignMap.set(campaign, (utmCampaignMap.get(campaign) ?? 0) + 1);
      }
    });

    logApiSuccess(ctx, 200, { customerCount, orderCount });
    return jsonOk(
      {
        totals: {
          visitors: uniqueVisitors,
          pageViews: pageViewEvents,
          customers: customerCount,
          orders: orderCount,
          revenue,
          avgOrderValue,
          avgLtv: Number(avgLtvAgg._avg.lifetimeValue ?? 0),
          repeatRate,
        },
        trends: {
          daily: dailyRange.map((date) => {
            const key = toDateKey(date);
            return {
              date: key,
              label: toLabel(date),
              pageViews: dailyPageViewMap.get(key) ?? 0,
              orders: dailyOrderMap.get(key) ?? 0,
            };
          }),
          weekly: weeklyRange.map((date) => {
            const key = toDateKey(date);
            return {
              week: key,
              label: `Week of ${toLabel(date)}`,
              pageViews: weeklyPageViewMap.get(key) ?? 0,
              orders: weeklyOrderMap.get(key) ?? 0,
            };
          }),
        },
        funnel: {
          productViews: viewEvents,
          addToBag: bagEvents,
          checkoutStarted: checkoutEvents,
          orders: orderCount,
          requests: requestEvents,
          viewToBagRate,
          bagToCheckoutRate,
          checkoutToOrderRate,
        },
        checkoutFlow: {
          addressReviewOpened: addressReviewEvents,
          paymentLinkRequested: paymentLinkRequestedEvents,
          paymentLinkCreated: paymentLinkCreatedEvents,
          paymentRedirectAttempted: paymentRedirectAttemptEvents,
          paymentRedirectFailed: paymentRedirectFailedEvents,
          paymentLinkRequestFailed: paymentLinkRequestFailedEvents,
          paidOrders: paidOrderCount,
          reviewToLinkRate,
          requestToLinkRate,
          requestFailureRate,
          linkToRedirectRate,
          redirectFailureRate,
          linkToPaidRate,
        },
        paymentLink: paymentLinkMetrics,
        aiOptimization,
        alerts,
        rfm: {
          recency: recencyBuckets,
          frequency: frequencyBuckets,
          monetary: monetaryBuckets,
        },
        value: {
          orderBuckets,
          repeatBuckets,
          ltvBuckets,
        },
        segments: segmentStats
          .filter((item) => item.segment)
          .map((item) => ({ segment: item.segment, count: item._count._all })),
        sources: sourceStats
          .filter((item) => item.source)
          .map((item) => ({ source: item.source, count: item._count._all })),
        utm: {
          sources: Array.from(utmSourceMap.entries())
            .map(([source, count]) => ({ source, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8),
          campaigns: Array.from(utmCampaignMap.entries())
            .map(([campaign, count]) => ({ campaign, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8),
        },
      },
      ctx,
    );
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load analytics", 500, ctx, { code: "ANALYTICS_FAILED" });
  }
}
