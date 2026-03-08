import { ANALYTICS_PROVIDER } from "@/lib/analytics/config";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    posthog?: { capture: (event: string, props?: Record<string, unknown>) => void };
    dataLayer?: unknown[];
  }
}

export function trackEvent(event: string, props?: Record<string, unknown>, email?: string) {
  if (typeof window === "undefined") return;
  if (ANALYTICS_PROVIDER === "ga4" && window.gtag) {
    window.gtag("event", event, props ?? {});
  }
  if (ANALYTICS_PROVIDER === "posthog" && window.posthog?.capture) {
    window.posthog.capture(event, props ?? {});
  }

  try {
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, metadata: props ?? {}, source: "web", email }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // ignore analytics failures
  }
}

export function trackPageView(path: string) {
  if (typeof window === "undefined") return;
  const location = window.location.href;
  if (ANALYTICS_PROVIDER === "ga4" && window.gtag) {
    window.gtag("event", "page_view", {
      page_location: location,
      page_path: path,
    });
  }
  if (ANALYTICS_PROVIDER === "posthog" && window.posthog?.capture) {
    window.posthog.capture("$pageview", { $current_url: location });
  }
}
