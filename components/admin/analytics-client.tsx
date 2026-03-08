"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";
import { formatPrice } from "@/lib/utils/format";

type AnalyticsPayload = {
  totals: {
    visitors: number;
    pageViews: number;
    customers: number;
    orders: number;
    revenue: number;
    avgOrderValue: number;
    avgLtv: number;
    repeatRate: number;
  };
  funnel: {
    productViews: number;
    addToBag: number;
    checkoutStarted: number;
    orders: number;
    requests: number;
    viewToBagRate: number;
    bagToCheckoutRate: number;
    checkoutToOrderRate: number;
  };
  checkoutFlow: {
    addressReviewOpened: number;
    paymentLinkRequested: number;
    paymentLinkCreated: number;
    paymentRedirectAttempted: number;
    paymentRedirectFailed: number;
    paymentLinkRequestFailed: number;
    paidOrders: number;
    reviewToLinkRate: number;
    requestToLinkRate: number;
    requestFailureRate: number;
    linkToRedirectRate: number;
    redirectFailureRate: number;
    linkToPaidRate: number;
  };
  paymentLink: {
    uptimeMinutes: number;
    api: {
      total: number;
      success: number;
      failure: number;
      pending: number;
      rejected: number;
      successRate: number;
      recentSuccessRate: number;
    };
    provider: {
      total: number;
      success: number;
      failure: number;
      successRate: number;
      recentSuccessRate: number;
    };
  };
  aiOptimization: {
    totals: {
      pending: number;
      inProgress: number;
      done: number;
      failed: number;
    };
    last24h: {
      queued: number;
      done: number;
      failed: number;
      successRate: number;
    };
    topErrors: Array<{ error: string; count: number }>;
  };
  alerts: Array<{
    id: string;
    level: "warning" | "critical";
    title: string;
    detail: string;
  }>;
  rfm: {
    recency: Record<string, number>;
    frequency: Record<string, number>;
    monetary: Record<string, number>;
  };
  value: {
    orderBuckets: Record<string, number>;
    repeatBuckets: Record<string, number>;
    ltvBuckets: Record<string, number>;
  };
  segments: Array<{ segment: string; count: number }>;
  sources: Array<{ source: string; count: number }>;
  utm: {
    sources: Array<{ source: string; count: number }>;
    campaigns: Array<{ campaign: string; count: number }>;
  };
  trends: {
    daily: Array<{ label: string; pageViews: number; orders: number }>;
    weekly: Array<{ label: string; pageViews: number; orders: number }>;
  };
};

type EmailHealthPayload = {
  configured: boolean;
  canSend: boolean;
  verified: boolean;
  missing: string[];
  host?: string;
  port: number;
  secure: boolean;
  from?: string;
  supportEmail?: string;
  isProduction: boolean;
  source: "SMTP" | "EMAIL_SERVER" | "none";
  verifyDurationMs?: number;
  verifyError?: string;
};

type EmailHealthResponsePayload = {
  health: EmailHealthPayload;
  recommendedRecipient?: string;
};

export function AnalyticsClient() {
  const toast = useToast();
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailHealth, setEmailHealth] = useState<EmailHealthPayload | null>(null);
  const [emailHealthLoading, setEmailHealthLoading] = useState(false);
  const [emailTestRecipient, setEmailTestRecipient] = useState("");
  const [sendingEmailTest, setSendingEmailTest] = useState(false);

  const parseEmailHealthResponse = (payload: unknown): EmailHealthResponsePayload | null => {
    const json = payload as
      | {
          data?: EmailHealthResponsePayload;
          health?: EmailHealthPayload;
          recommendedRecipient?: string;
        }
      | undefined;
    if (!json) return null;
    if (json.data?.health) return json.data;
    if (json.health) {
      return {
        health: json.health,
        recommendedRecipient: json.recommendedRecipient,
      };
    }
    return null;
  };

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/analytics");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load analytics");
      }
      setData(json.data ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load analytics");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadEmailHealth = useCallback(async () => {
    setEmailHealthLoading(true);
    try {
      const res = await fetch("/api/admin/email/health");
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load email health");
      }
      const parsed = parseEmailHealthResponse(json);
      if (!parsed) {
        throw new Error("Unable to parse email health response");
      }
      setEmailHealth(parsed.health);
      if (parsed.recommendedRecipient && !emailTestRecipient.trim()) {
        setEmailTestRecipient(parsed.recommendedRecipient);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load email health");
    } finally {
      setEmailHealthLoading(false);
    }
  }, [emailTestRecipient, toast]);

  const sendTestEmail = useCallback(async () => {
    setSendingEmailTest(true);
    try {
      const recipient = emailTestRecipient.trim();
      const res = await fetch("/api/admin/email/health", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: recipient || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Failed to send test email");
      }
      const sentTo = json?.data?.to ?? json?.to ?? recipient;
      toast.success(`Test email sent${sentTo ? ` to ${sentTo}` : ""}`);
      await loadEmailHealth();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send test email");
    } finally {
      setSendingEmailTest(false);
    }
  }, [emailTestRecipient, loadEmailHealth, toast]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    loadEmailHealth();
  }, [loadEmailHealth]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={loadAnalytics}>
          Refresh analytics
        </Button>
        <Button variant="ghost" onClick={loadEmailHealth} disabled={emailHealthLoading}>
          {emailHealthLoading ? "Checking email..." : "Refresh email health"}
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading analytics...</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">No analytics available.</p>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg">Email Health</h3>
                <p className="mt-1 text-xs text-muted">
                  SMTP readiness and test-send utility for account sign-in and order emails.
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs ${
                  emailHealth?.verified
                    ? "border-green-300 bg-green-50 text-green-700"
                    : emailHealth?.canSend
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-red-300 bg-red-50 text-red-700"
                }`}
              >
                {emailHealth?.verified
                  ? "Verified"
                  : emailHealth?.canSend
                    ? "Configured (verify warning)"
                    : "Not configured"}
              </span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <MetricCard label="Configured" value={emailHealth?.configured ? "Yes" : "No"} />
              <MetricCard label="Can send" value={emailHealth?.canSend ? "Yes" : "No"} />
              <MetricCard label="Verified" value={emailHealth?.verified ? "Yes" : "No"} />
              <MetricCard label="Source" value={emailHealth?.source ?? "unknown"} />
            </div>
            <div className="mt-3 rounded-xl border border-border bg-contrast p-3 text-sm text-muted">
              <p>
                Host: <span className="text-ink">{emailHealth?.host ?? "-"}</span> / Port:{" "}
                <span className="text-ink">{emailHealth?.port ?? "-"}</span> / Secure:{" "}
                <span className="text-ink">{emailHealth?.secure ? "true" : "false"}</span>
              </p>
              <p>
                From: <span className="text-ink">{emailHealth?.from ?? "-"}</span>
              </p>
              {emailHealth?.missing?.length ? (
                <p>
                  Missing: <span className="text-ink">{emailHealth.missing.join(", ")}</span>
                </p>
              ) : null}
              {emailHealth?.verifyError ? (
                <p>
                  Verify error: <span className="text-ink">{emailHealth.verifyError}</span>
                </p>
              ) : null}
              {typeof emailHealth?.verifyDurationMs === "number" ? (
                <p>
                  Verify duration: <span className="text-ink">{emailHealth.verifyDurationMs}ms</span>
                </p>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <Input
                label="Test recipient"
                type="email"
                value={emailTestRecipient}
                onChange={(event) => setEmailTestRecipient(event.target.value)}
                placeholder="you@example.com"
              />
              <Button onClick={sendTestEmail} loading={sendingEmailTest} disabled={sendingEmailTest}>
                Send test email
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Visitors" value={data.totals.visitors} />
            <MetricCard label="Page views" value={data.totals.pageViews} />
            <MetricCard label="Customers" value={data.totals.customers} />
            <MetricCard label="Orders" value={data.totals.orders} />
            <MetricCard label="Repeat rate" value={`${data.totals.repeatRate}%`} />
            <MetricCard label="Revenue" value={formatPrice(data.totals.revenue, "USD")} />
            <MetricCard label="AOV" value={formatPrice(data.totals.avgOrderValue, "USD")} />
            <MetricCard label="Avg LTV" value={formatPrice(data.totals.avgLtv, "USD")} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="font-display text-lg">Top segments</h3>
              {data.segments.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No segments yet.</p>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  {data.segments.map((segment) => (
                    <div key={segment.segment} className="flex items-center justify-between">
                      <span>{segment.segment}</span>
                      <span className="text-muted">{segment.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="font-display text-lg">Top sources</h3>
              {data.sources.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No sources yet.</p>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  {data.sources.map((source) => (
                    <div key={source.source} className="flex items-center justify-between">
                      <span>{source.source}</span>
                      <span className="text-muted">{source.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TrendChart title="Daily trend (14 days)" data={data.trends.daily} />
            <TrendChart title="Weekly trend (12 weeks)" data={data.trends.weekly} />
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="font-display text-lg">Payment Link Health</h3>
            <p className="mt-1 text-xs text-muted">
              Uptime window: {data.paymentLink.uptimeMinutes} minutes
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <MetricCard
                label="API success rate"
                value={`${data.paymentLink.api.successRate}%`}
              />
              <MetricCard
                label="API success (1h)"
                value={`${data.paymentLink.api.recentSuccessRate}%`}
              />
              <MetricCard
                label="Inflyway success rate"
                value={`${data.paymentLink.provider.successRate}%`}
              />
              <MetricCard
                label="Inflyway success (1h)"
                value={`${data.paymentLink.provider.recentSuccessRate}%`}
              />
            </div>
            <div className="mt-3 grid gap-3 text-sm text-muted md:grid-cols-2">
              <div className="rounded-xl border border-border bg-contrast px-3 py-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">API Outcomes</p>
                <div className="mt-2 space-y-1">
                  <FunnelRow label="Total" value={data.paymentLink.api.total} />
                  <FunnelRow label="Success" value={data.paymentLink.api.success} />
                  <FunnelRow label="Failure" value={data.paymentLink.api.failure} />
                  <FunnelRow label="Pending" value={data.paymentLink.api.pending} />
                  <FunnelRow label="Rejected" value={data.paymentLink.api.rejected} />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-contrast px-3 py-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Inflyway Outcomes</p>
                <div className="mt-2 space-y-1">
                  <FunnelRow label="Total" value={data.paymentLink.provider.total} />
                  <FunnelRow label="Success" value={data.paymentLink.provider.success} />
                  <FunnelRow label="Failure" value={data.paymentLink.provider.failure} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg">AI Optimization Health</h3>
                <p className="mt-1 text-xs text-muted">Pending/failed tracking with 24h success KPI.</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <MetricCard label="Pending" value={data.aiOptimization.totals.pending} />
              <MetricCard label="In Progress" value={data.aiOptimization.totals.inProgress} />
              <MetricCard label="Failed (24h)" value={data.aiOptimization.last24h.failed} />
              <MetricCard label="Success (24h)" value={`${data.aiOptimization.last24h.successRate}%`} />
            </div>
            {data.aiOptimization.topErrors.length > 0 ? (
              <div className="mt-3 rounded-xl border border-border bg-contrast px-3 py-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Top errors (24h)</p>
                <div className="mt-2 space-y-1 text-sm text-muted">
                  {data.aiOptimization.topErrors.map((item) => (
                    <div key={item.error} className="flex items-center justify-between gap-3">
                      <span>{item.error}</span>
                      <span className="text-ink">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="font-display text-lg">Daily Alerts</h3>
            {data.alerts.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No active alerts in current window.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {data.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      alert.level === "critical"
                        ? "border-red-300 bg-red-50 text-red-800"
                        : "border-amber-300 bg-amber-50 text-amber-900"
                    }`}
                  >
                    <p className="font-medium">{alert.title}</p>
                    <p className="mt-1 text-xs">{alert.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="font-display text-lg">Checkout Link Funnel</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <MetricCard
                label="Review to Link"
                value={`${data.checkoutFlow.reviewToLinkRate}%`}
              />
              <MetricCard
                label="Request to Link"
                value={`${data.checkoutFlow.requestToLinkRate}%`}
              />
              <MetricCard
                label="Link to Paid"
                value={`${data.checkoutFlow.linkToPaidRate}%`}
              />
              <MetricCard
                label="Request Failure"
                value={`${data.checkoutFlow.requestFailureRate}%`}
              />
              <MetricCard
                label="Link to Redirect"
                value={`${data.checkoutFlow.linkToRedirectRate}%`}
              />
              <MetricCard
                label="Redirect Failure"
                value={`${data.checkoutFlow.redirectFailureRate}%`}
              />
            </div>
            <div className="mt-3 grid gap-3 text-sm text-muted md:grid-cols-2">
              <div className="rounded-xl border border-border bg-contrast px-3 py-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Flow Events</p>
                <div className="mt-2 space-y-1">
                  <FunnelRow label="Address review opened" value={data.checkoutFlow.addressReviewOpened} />
                  <FunnelRow label="Link requested" value={data.checkoutFlow.paymentLinkRequested} />
                  <FunnelRow label="Link created" value={data.checkoutFlow.paymentLinkCreated} />
                  <FunnelRow label="Redirect attempted" value={data.checkoutFlow.paymentRedirectAttempted} />
                  <FunnelRow label="Redirect failed" value={data.checkoutFlow.paymentRedirectFailed} />
                  <FunnelRow label="Request failed" value={data.checkoutFlow.paymentLinkRequestFailed} />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-contrast px-3 py-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Conversion Outcomes</p>
                <div className="mt-2 space-y-1">
                  <FunnelRow label="Paid orders" value={data.checkoutFlow.paidOrders} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="font-display text-lg">Conversion funnel</h3>
              <div className="mt-3 space-y-2 text-sm text-muted">
                <FunnelRow label="Product views" value={data.funnel.productViews} />
                <FunnelRow label="Add to bag" value={data.funnel.addToBag} />
                <FunnelRow label="Checkout started" value={data.funnel.checkoutStarted} />
                <FunnelRow label="Orders" value={data.funnel.orders} />
                <FunnelRow label="Requests" value={data.funnel.requests} />
              </div>
              <div className="mt-3 grid gap-2 text-xs text-muted">
                <span>View to Bag: {data.funnel.viewToBagRate}%</span>
                <span>Bag to Checkout: {data.funnel.bagToCheckoutRate}%</span>
                <span>Checkout to Order: {data.funnel.checkoutToOrderRate}%</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="font-display text-lg">RFM snapshot</h3>
              <div className="mt-3 grid gap-3 text-sm">
                <RfmBlock title="Recency" data={data.rfm.recency} />
                <RfmBlock title="Frequency" data={data.rfm.frequency} />
                <RfmBlock title="Monetary" data={data.rfm.monetary} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="font-display text-lg">Order ladder</h3>
              <ValueList data={data.value.orderBuckets} />
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="font-display text-lg">Repeat mix</h3>
              <ValueList data={data.value.repeatBuckets} />
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="font-display text-lg">LTV tiers</h3>
              <ValueList data={data.value.ltvBuckets} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="font-display text-lg">UTM sources</h3>
              {data.utm.sources.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No UTM sources recorded.</p>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  {data.utm.sources.map((utm) => (
                    <div key={utm.source} className="flex items-center justify-between">
                      <span>{utm.source}</span>
                      <span className="text-muted">{utm.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="font-display text-lg">UTM campaigns</h3>
              {data.utm.campaigns.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No UTM campaigns recorded.</p>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  {data.utm.campaigns.map((utm) => (
                    <div key={utm.campaign} className="flex items-center justify-between">
                      <span>{utm.campaign}</span>
                      <span className="text-muted">{utm.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function FunnelRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function RfmBlock({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <div className="rounded-xl border border-border bg-contrast px-3 py-2">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">{title}</p>
      <div className="mt-2 space-y-1 text-sm text-muted">
        {Object.entries(data).map(([bucket, count]) => (
          <div key={bucket} className="flex items-center justify-between">
            <span>{bucket}</span>
            <span className="text-ink">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValueList({ data }: { data: Record<string, number> }) {
  return (
    <div className="mt-3 space-y-2 text-sm text-muted">
      {Object.entries(data).map(([bucket, count]) => (
        <div key={bucket} className="flex items-center justify-between">
          <span>{bucket}</span>
          <span className="text-ink">{count}</span>
        </div>
      ))}
    </div>
  );
}

function TrendChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ label: string; pageViews: number; orders: number }>;
}) {
  const totalViews = data.reduce((acc, item) => acc + item.pageViews, 0);
  const totalOrders = data.reduce((acc, item) => acc + item.orders, 0);
  const maxValue = Math.max(
    1,
    ...data.map((item) => Math.max(item.pageViews, item.orders)),
  );
  const height = 40;
  const pointCount = data.length;
  const midIndex = Math.floor(pointCount / 2);

  const buildPoints = (key: "pageViews" | "orders") =>
    data
      .map((item, index) => {
        const x = pointCount <= 1 ? 50 : (index / (pointCount - 1)) * 100;
        const y = height - (item[key] / maxValue) * height;
        return `${x},${y}`;
      })
      .join(" ");

  const pageViewPoints = buildPoints("pageViews");
  const orderPoints = buildPoints("orders");

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Trends</p>
          <h3 className="mt-2 font-display text-lg">{title}</h3>
        </div>
        <div className="space-y-1 text-xs text-muted">
          <div className="flex items-center justify-end gap-2">
            <span className="h-2 w-2 rounded-full bg-ink" />
            <span>Page views: {totalViews}</span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span>Orders: {totalOrders}</span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <svg
          viewBox={`0 0 100 ${height}`}
          className="h-16 w-full"
          role="img"
          aria-label={title}
        >
          <polyline
            points={pageViewPoints}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-ink"
          />
          <polyline
            points={orderPoints}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-accent"
          />
        </svg>
        {data.length > 0 && (
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
            <span>{data[0]?.label}</span>
            <span>{data[midIndex]?.label}</span>
            <span>{data[pointCount - 1]?.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
