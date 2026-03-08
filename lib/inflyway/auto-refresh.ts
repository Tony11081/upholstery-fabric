import { checkInflywayTokenHealth } from "@/lib/inflyway/client";
import { refreshInflywayTokenWithPlaywright } from "@/lib/inflyway/playwright-login";
import { maskToken, resolveInflywayToken, saveInflywayToken } from "@/lib/inflyway/runtime-token-store";

type AutoRefreshState = {
  startedAt: number;
  started: boolean;
  running: boolean;
  intervalMs: number;
  checksTotal: number;
  checksSuccess: number;
  checksFailure: number;
  refreshAttempts: number;
  refreshSuccess: number;
  consecutiveFailures: number;
  lastCheckAt: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastRefreshAt: number | null;
  lastError: string | null;
  tokenSource: string;
  tokenMasked: string;
  lastHealthCode: string | null;
};

export type InflywayAutoRefreshSnapshot = {
  enabled: boolean;
  started: boolean;
  running: boolean;
  intervalMs: number;
  checksTotal: number;
  checksSuccess: number;
  checksFailure: number;
  successRate: number;
  refreshAttempts: number;
  refreshSuccess: number;
  consecutiveFailures: number;
  lastCheckAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastRefreshAt: string | null;
  lastError: string | null;
  tokenSource: string;
  tokenMasked: string;
  lastHealthCode: string | null;
};

type AutoRefreshGlobal = {
  state: AutoRefreshState;
  timer: NodeJS.Timeout | null;
  currentRun: Promise<void> | null;
};

function getIntervalMs() {
  const value = Number(process.env.INFLYWAY_HEALTHCHECK_INTERVAL_MS ?? "300000");
  if (!Number.isFinite(value) || value < 60_000) return 300_000;
  return value;
}

function isEnabled() {
  const value = (process.env.INFLYWAY_AUTO_REFRESH_ENABLED ?? "true").toLowerCase();
  return value !== "0" && value !== "false" && value !== "off";
}

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function readEnvToken() {
  return stripWrappingQuotes(process.env.INFLYWAY_TOKEN ?? "");
}

function toIso(value: number | null) {
  return value ? new Date(value).toISOString() : null;
}

function toRate(success: number, total: number) {
  if (total <= 0) return 0;
  return Number(((success / total) * 100).toFixed(1));
}

function getGlobalState(): AutoRefreshGlobal {
  const key = "__inflyway_auto_refresh__";
  const globalScope = globalThis as typeof globalThis & {
    [key]?: AutoRefreshGlobal;
  };
  if (!globalScope[key]) {
    globalScope[key] = {
      state: {
        startedAt: Date.now(),
        started: false,
        running: false,
        intervalMs: getIntervalMs(),
        checksTotal: 0,
        checksSuccess: 0,
        checksFailure: 0,
        refreshAttempts: 0,
        refreshSuccess: 0,
        consecutiveFailures: 0,
        lastCheckAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastRefreshAt: null,
        lastError: null,
        tokenSource: "none",
        tokenMasked: "",
        lastHealthCode: null,
      },
      timer: null,
      currentRun: null,
    };
  }
  return globalScope[key]!;
}

function hasLoginCredentials() {
  return Boolean(
    process.env.INFLYWAY_LOGIN_ACCOUNT?.trim() &&
      process.env.INFLYWAY_LOGIN_PASSWORD?.trim(),
  );
}

function getSnapshot(state: AutoRefreshState): InflywayAutoRefreshSnapshot {
  return {
    enabled: isEnabled(),
    started: state.started,
    running: state.running,
    intervalMs: state.intervalMs,
    checksTotal: state.checksTotal,
    checksSuccess: state.checksSuccess,
    checksFailure: state.checksFailure,
    successRate: toRate(state.checksSuccess, state.checksTotal),
    refreshAttempts: state.refreshAttempts,
    refreshSuccess: state.refreshSuccess,
    consecutiveFailures: state.consecutiveFailures,
    lastCheckAt: toIso(state.lastCheckAt),
    lastSuccessAt: toIso(state.lastSuccessAt),
    lastFailureAt: toIso(state.lastFailureAt),
    lastRefreshAt: toIso(state.lastRefreshAt),
    lastError: state.lastError,
    tokenSource: state.tokenSource,
    tokenMasked: state.tokenMasked,
    lastHealthCode: state.lastHealthCode,
  };
}

async function attemptPlaywrightRefresh(
  state: AutoRefreshState,
  reason: string,
) {
  state.refreshAttempts += 1;
  const loginResult = await refreshInflywayTokenWithPlaywright();
  if (!loginResult.ok || !loginResult.token) {
    state.checksFailure += 1;
    state.consecutiveFailures += 1;
    state.lastFailureAt = Date.now();
    state.lastError = loginResult.error || "Playwright token refresh failed";
    return false;
  }

  await saveInflywayToken(loginResult.token, {
    source: loginResult.source ?? "playwright_login",
    reason,
  });
  state.lastRefreshAt = Date.now();
  state.refreshSuccess += 1;
  state.tokenSource = loginResult.source ?? "playwright_login";
  state.tokenMasked = maskToken(loginResult.token);

  const postRefreshHealth = await checkInflywayTokenHealth(loginResult.token);
  state.lastHealthCode = postRefreshHealth.code ?? state.lastHealthCode;
  if (!postRefreshHealth.ok) {
    state.checksFailure += 1;
    state.consecutiveFailures += 1;
    state.lastFailureAt = Date.now();
    state.lastError =
      postRefreshHealth.error ||
      postRefreshHealth.message ||
      `Refresh completed but health failed (${postRefreshHealth.code ?? "unknown"})`;
    return false;
  }

  state.checksSuccess += 1;
  state.consecutiveFailures = 0;
  state.lastSuccessAt = Date.now();
  state.lastError = null;
  return true;
}

async function runHealthCheckInternal(reason: string) {
  const global = getGlobalState();
  const state = global.state;
  state.running = true;
  state.lastError = null;
  state.lastCheckAt = Date.now();
  state.checksTotal += 1;

  try {
    const tokenInfo = await resolveInflywayToken();
    state.tokenSource = tokenInfo.source;
    state.tokenMasked = maskToken(tokenInfo.token);

    if (!tokenInfo.token) {
      state.lastHealthCode = "TOKEN_MISSING";
      if (!hasLoginCredentials()) {
        state.checksFailure += 1;
        state.consecutiveFailures += 1;
        state.lastFailureAt = Date.now();
        state.lastError = "Inflyway token missing";
        return;
      }
      await attemptPlaywrightRefresh(state, reason);
      return;
    }

    const health = await checkInflywayTokenHealth(tokenInfo.token);
    state.lastHealthCode = health.code ?? null;
    if (health.ok) {
      state.checksSuccess += 1;
      state.consecutiveFailures = 0;
      state.lastSuccessAt = Date.now();
      state.lastError = null;
      if (tokenInfo.source === "env") {
        await saveInflywayToken(tokenInfo.token, {
          source: "env_bootstrap",
          reason,
        });
        state.tokenSource = "runtime";
      }
      return;
    }

    // If the runtime token is stale but the operator has updated INFLYWAY_TOKEN,
    // allow the env token to "rescue" the system and overwrite the stored token.
    const envToken = readEnvToken();
    if (envToken && envToken !== tokenInfo.token) {
      const envHealth = await checkInflywayTokenHealth(envToken);
      if (envHealth.ok) {
        await saveInflywayToken(envToken, {
          source: "env_override",
          reason,
        });
        state.checksSuccess += 1;
        state.consecutiveFailures = 0;
        state.lastSuccessAt = Date.now();
        state.lastError = null;
        state.lastHealthCode = envHealth.code ?? state.lastHealthCode;
        state.tokenSource = "env_override";
        state.tokenMasked = maskToken(envToken);
        return;
      }
    }

    const failedReason =
      health.error || health.message || `Health check failed (${health.code ?? "unknown"})`;

    if (!hasLoginCredentials()) {
      state.checksFailure += 1;
      state.consecutiveFailures += 1;
      state.lastFailureAt = Date.now();
      state.lastError = failedReason;
      return;
    }

    await attemptPlaywrightRefresh(state, reason);
  } catch (error) {
    state.checksFailure += 1;
    state.consecutiveFailures += 1;
    state.lastFailureAt = Date.now();
    state.lastError = error instanceof Error ? error.message : "Unknown health check error";
  } finally {
    state.running = false;
  }
}

async function runHealthCheck(reason: string) {
  const global = getGlobalState();
  if (global.currentRun) {
    await global.currentRun;
    return;
  }
  global.currentRun = runHealthCheckInternal(reason).finally(() => {
    global.currentRun = null;
  });
  await global.currentRun;
}

export function ensureInflywayAutoRefreshStarted() {
  if (!isEnabled()) {
    return getSnapshot(getGlobalState().state);
  }
  const global = getGlobalState();
  const state = global.state;
  if (state.started) {
    return getSnapshot(state);
  }
  state.started = true;
  state.intervalMs = getIntervalMs();
  global.timer = setInterval(() => {
    void runHealthCheck("interval");
  }, state.intervalMs);
  void runHealthCheck("startup");
  return getSnapshot(state);
}

export async function triggerInflywayHealthCheck(reason = "manual") {
  ensureInflywayAutoRefreshStarted();
  await runHealthCheck(reason);
  return getSnapshot(getGlobalState().state);
}

export function getInflywayAutoRefreshSnapshot() {
  return getSnapshot(getGlobalState().state);
}
