"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type AutoRefreshSnapshot = {
  started: boolean;
  running: boolean;
  intervalMs: number;
  checksTotal: number;
  checksSuccess: number;
  checksFailure: number;
  successRate: number;
  refreshAttempts: number;
  refreshSuccess: number;
  tokenSource: string;
  tokenMasked: string;
  lastCheckAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastRefreshAt: string | null;
  lastError: string | null;
  lastHealthCode: string | null;
};

type HealthPayload = {
  autoRefresh: AutoRefreshSnapshot;
};

function formatTime(value?: string | null) {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function InflywayHealthCard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<AutoRefreshSnapshot | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/inflyway/health", { cache: "no-store" });
      const data = (await res.json()) as { data?: HealthPayload; error?: { message?: string } };
      if (!res.ok || !data?.data?.autoRefresh) {
        throw new Error(data?.error?.message ?? "Unable to load Inflyway health");
      }
      setSnapshot(data.data.autoRefresh);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load Inflyway health");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshNow = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/inflyway/health", {
        method: "POST",
      });
      const data = (await res.json()) as { data?: HealthPayload; error?: { message?: string } };
      if (!res.ok || !data?.data?.autoRefresh) {
        throw new Error(data?.error?.message ?? "Manual refresh failed");
      }
      setSnapshot(data.data.autoRefresh);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Manual refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const statusLabel = useMemo(() => {
    if (!snapshot) return "Unknown";
    if (snapshot.running) return "Checking";
    if (snapshot.lastError) return "Degraded";
    return "Healthy";
  }, [snapshot]);

  const playwrightFixHint = useMemo(() => {
    const message = snapshot?.lastError ?? "";
    if (!message) return null;
    const isPlaywrightMissing =
      message.includes("Executable doesn't exist") ||
      message.includes("Please run the following command to download new browsers") ||
      message.includes("Playwright");
    if (!isPlaywrightMissing) return null;
    return `cd /app
export PLAYWRIGHT_BROWSERS_PATH=0
unset PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
unset INFLYWAY_PLAYWRIGHT_EXECUTABLE_PATH
node node_modules/playwright/cli.js install chromium --force
node node_modules/playwright/cli.js install chromium-headless-shell --force`;
  }, [snapshot?.lastError]);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Inflyway</p>
          <h2 className="text-lg font-medium">Token auto refresh</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => void load()} disabled={loading}>
            Reload
          </Button>
          <Button size="sm" className="rounded-full" onClick={() => void refreshNow()} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Manual refresh"}
          </Button>
        </div>
      </div>

      {loading && !snapshot ? <p className="mt-3 text-sm text-muted">Loading health status...</p> : null}
      {error ? (
        <div className="mt-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {snapshot ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 text-sm text-muted sm:grid-cols-2">
            <p>Status: <span className="font-medium text-ink">{statusLabel}</span></p>
            <p>Token source: <span className="font-medium text-ink">{snapshot.tokenSource}</span></p>
            <p>Token: <span className="font-medium text-ink">{snapshot.tokenMasked || "N/A"}</span></p>
            <p>Last code: <span className="font-medium text-ink">{snapshot.lastHealthCode ?? "N/A"}</span></p>
            <p>Checks: <span className="font-medium text-ink">{snapshot.checksTotal}</span></p>
            <p>Success rate: <span className="font-medium text-ink">{snapshot.successRate}%</span></p>
            <p>Refresh attempts: <span className="font-medium text-ink">{snapshot.refreshAttempts}</span></p>
            <p>Refresh success: <span className="font-medium text-ink">{snapshot.refreshSuccess}</span></p>
            <p>Last check: <span className="font-medium text-ink">{formatTime(snapshot.lastCheckAt)}</span></p>
            <p>Last refresh: <span className="font-medium text-ink">{formatTime(snapshot.lastRefreshAt)}</span></p>
            <p className="sm:col-span-2">
              Last error: <span className="font-medium text-ink">{snapshot.lastError ?? "None"}</span>
            </p>
          </div>

          {playwrightFixHint ? (
            <div className="rounded-xl border border-border bg-surface p-3 text-sm">
              <p className="font-medium text-ink">Playwright 修复指令（容器内执行）</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-black/5 p-2 text-xs text-ink">
                {playwrightFixHint}
              </pre>
              <p className="mt-2 text-xs text-muted">
                如果你之前设置过{" "}
                <span className="font-mono text-ink">INFLYWAY_PLAYWRIGHT_EXECUTABLE_PATH</span>，请先清空；只有在你确认路径真实存在时再设置。
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
