type ApiOutcome = "success" | "failure" | "pending" | "rejected";
type ProviderOutcome = "success" | "failure";

type TimedOutcome<T extends string> = {
  at: number;
  outcome: T;
};

type MetricsState = {
  startedAt: number;
  api: Record<ApiOutcome, number>;
  provider: Record<ProviderOutcome, number>;
  apiRecent: TimedOutcome<ApiOutcome>[];
  providerRecent: TimedOutcome<ProviderOutcome>[];
};

export type PaymentLinkMetricsSnapshot = {
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

const RECENT_WINDOW_MS = 60 * 60 * 1000;
const RECENT_MAX = 300;

function createInitialState(): MetricsState {
  return {
    startedAt: Date.now(),
    api: { success: 0, failure: 0, pending: 0, rejected: 0 },
    provider: { success: 0, failure: 0 },
    apiRecent: [],
    providerRecent: [],
  };
}

function getMetricsState(): MetricsState {
  const globalKey = "__payment_link_metrics__";
  const globalScope = globalThis as typeof globalThis & {
    [globalKey]?: MetricsState;
  };
  if (!globalScope[globalKey]) {
    globalScope[globalKey] = createInitialState();
  }
  return globalScope[globalKey]!;
}

function trimRecent<T extends string>(items: TimedOutcome<T>[]) {
  const cutoff = Date.now() - RECENT_WINDOW_MS;
  while (items.length > 0 && items[0]!.at < cutoff) {
    items.shift();
  }
  if (items.length > RECENT_MAX) {
    items.splice(0, items.length - RECENT_MAX);
  }
}

function pushRecent<T extends string>(items: TimedOutcome<T>[], outcome: T) {
  items.push({ at: Date.now(), outcome });
  trimRecent(items);
}

function toRate(success: number, total: number) {
  if (total <= 0) return 0;
  return Number(((success / total) * 100).toFixed(1));
}

export function getPaymentLinkMetricsSnapshot(): PaymentLinkMetricsSnapshot {
  const state = getMetricsState();
  trimRecent(state.apiRecent);
  trimRecent(state.providerRecent);

  const apiCompleted = state.api.success + state.api.failure;
  const providerCompleted = state.provider.success + state.provider.failure;

  const apiRecentCompleted = state.apiRecent.filter(
    (entry) => entry.outcome === "success" || entry.outcome === "failure",
  );
  const apiRecentSuccess = apiRecentCompleted.filter(
    (entry) => entry.outcome === "success",
  ).length;
  const providerRecentSuccess = state.providerRecent.filter(
    (entry) => entry.outcome === "success",
  ).length;

  return {
    uptimeMinutes: Math.round((Date.now() - state.startedAt) / 60000),
    api: {
      total: state.api.success + state.api.failure + state.api.pending + state.api.rejected,
      success: state.api.success,
      failure: state.api.failure,
      pending: state.api.pending,
      rejected: state.api.rejected,
      successRate: toRate(state.api.success, apiCompleted),
      recentSuccessRate: toRate(apiRecentSuccess, apiRecentCompleted.length),
    },
    provider: {
      total: providerCompleted,
      success: state.provider.success,
      failure: state.provider.failure,
      successRate: toRate(state.provider.success, providerCompleted),
      recentSuccessRate: toRate(providerRecentSuccess, state.providerRecent.length),
    },
  };
}

export function recordPaymentLinkApiOutcome(
  outcome: ApiOutcome,
): PaymentLinkMetricsSnapshot {
  const state = getMetricsState();
  state.api[outcome] += 1;
  pushRecent(state.apiRecent, outcome);
  return getPaymentLinkMetricsSnapshot();
}

export function recordPaymentLinkProviderOutcome(
  outcome: ProviderOutcome,
): PaymentLinkMetricsSnapshot {
  const state = getMetricsState();
  state.provider[outcome] += 1;
  pushRecent(state.providerRecent, outcome);
  return getPaymentLinkMetricsSnapshot();
}
