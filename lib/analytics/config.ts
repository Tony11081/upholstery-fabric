export type AnalyticsProvider = "ga4" | "posthog" | "none";

const rawProvider = (process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? "none").toLowerCase();
export const ANALYTICS_PROVIDER: AnalyticsProvider =
  rawProvider === "ga4" || rawProvider === "posthog" ? rawProvider : "none";

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";
export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";
