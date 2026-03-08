type AiLimiterState = {
  active: number;
  queue: Array<() => void>;
  timestamps: number[];
};

type AiLimiterConfig = {
  ratePerMinute: number;
  concurrency: number;
};

function getLimiterState(): AiLimiterState {
  const globalAny = globalThis as typeof globalThis & { __aiLimiter?: AiLimiterState };
  if (!globalAny.__aiLimiter) {
    globalAny.__aiLimiter = { active: 0, queue: [], timestamps: [] };
  }
  return globalAny.__aiLimiter;
}

function getConfig(): AiLimiterConfig {
  return {
    ratePerMinute: Number(process.env.AI_RATE_LIMIT_PER_MINUTE ?? 30),
    concurrency: Number(process.env.AI_CONCURRENCY_LIMIT ?? 2),
  };
}

export async function acquireAiSlot() {
  const state = getLimiterState();
  const { ratePerMinute, concurrency } = getConfig();
  const now = Date.now();

  if (ratePerMinute > 0) {
    const windowMs = 60_000;
    state.timestamps = state.timestamps.filter((ts) => now - ts < windowMs);
    if (state.timestamps.length >= ratePerMinute) {
      const oldest = state.timestamps[0] ?? now;
      const retryAfterMs = Math.max(1000, windowMs - (now - oldest));
      const error = new Error("AI rate limit exceeded");
      (error as Error & { retryAfterMs?: number }).retryAfterMs = retryAfterMs;
      throw error;
    }
  }

  if (concurrency > 0 && state.active >= concurrency) {
    await new Promise<void>((resolve) => state.queue.push(resolve));
  }

  state.active += 1;
  state.timestamps.push(now);

  return () => {
    state.active = Math.max(0, state.active - 1);
    const next = state.queue.shift();
    if (next) next();
  };
}
