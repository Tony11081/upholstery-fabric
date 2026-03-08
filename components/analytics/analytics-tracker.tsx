"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent, trackPageView } from "@/lib/analytics/client";
import { captureUtmFromParams } from "@/lib/analytics/utm";

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    captureUtmFromParams(searchParams);
    trackPageView(path);
    trackEvent("page_view", { path, query: query || null });
  }, [pathname, searchParams]);

  return null;
}
