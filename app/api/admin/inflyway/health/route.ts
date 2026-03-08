import { getAdminSession } from "@/lib/auth/admin";
import { isOpenClawAdminRequest } from "@/lib/auth/openclaw-admin";
import {
  ensureInflywayAutoRefreshStarted,
  getInflywayAutoRefreshSnapshot,
  triggerInflywayHealthCheck,
} from "@/lib/inflyway/auto-refresh";
import { getPaymentLinkMetricsSnapshot } from "@/lib/inflyway/payment-link-metrics";
import {
  createApiContext,
  jsonError,
  jsonOk,
  logApiError,
  logApiSuccess,
  logApiWarning,
} from "@/lib/utils/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  const openclawAuthorized = isOpenClawAdminRequest(request);
  if (!session && !openclawAuthorized) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  try {
    ensureInflywayAutoRefreshStarted();
    const snapshot = getInflywayAutoRefreshSnapshot();
    const metrics = getPaymentLinkMetricsSnapshot();
    logApiSuccess(ctx, 200, {
      inflywayStatus: snapshot.lastError ? "degraded" : "ok",
      checksTotal: snapshot.checksTotal,
      refreshAttempts: snapshot.refreshAttempts,
    });
    return jsonOk(
      {
        autoRefresh: snapshot,
        paymentLinkMetrics: metrics,
      },
      ctx,
    );
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to load Inflyway health", 500, ctx, {
      code: "INFLYWAY_HEALTH_FAILED",
    });
  }
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  const openclawAuthorized = isOpenClawAdminRequest(request);
  if (!session) {
    if (openclawAuthorized) {
      logApiWarning(ctx, 403, { authorized: false, reason: "openclaw_readonly" });
      return jsonError("Forbidden", 403, ctx, { code: "FORBIDDEN" });
    }
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  try {
    const snapshot = await triggerInflywayHealthCheck("admin_manual");
    const metrics = getPaymentLinkMetricsSnapshot();
    logApiSuccess(ctx, 200, {
      action: "manual_refresh",
      checksTotal: snapshot.checksTotal,
      refreshAttempts: snapshot.refreshAttempts,
      lastError: snapshot.lastError,
    });
    return jsonOk(
      {
        refreshed: true,
        autoRefresh: snapshot,
        paymentLinkMetrics: metrics,
      },
      ctx,
    );
  } catch (error) {
    logApiError(ctx, 500, error, { action: "manual_refresh" });
    return jsonError("Manual refresh failed", 500, ctx, {
      code: "INFLYWAY_MANUAL_REFRESH_FAILED",
    });
  }
}
