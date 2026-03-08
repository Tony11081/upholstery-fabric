"use client";

import { useEffect, useState } from "react";

export function useExperiment(slug: string, defaultVariant = "control") {
  const [variant, setVariant] = useState(defaultVariant);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/experiments/assign?slug=${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        const next = data?.data?.variant ?? data?.variant ?? defaultVariant;
        setVariant(next);
        setActive(Boolean(data?.data?.active ?? data?.active));
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [slug, defaultVariant]);

  return { variant, active };
}

export function trackExperimentEvent(slug: string, event: string, metadata?: Record<string, unknown>) {
  fetch("/api/experiments/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, event, metadata }),
    keepalive: true,
  }).catch(() => undefined);
}

