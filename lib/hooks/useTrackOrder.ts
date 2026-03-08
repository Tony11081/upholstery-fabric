"use client";

import { useMutation } from "@tanstack/react-query";
import type { OrderWithRelations } from "@/lib/data/orders";

type TrackOrderPayload = {
  orderNumber: string;
  email: string;
};

async function trackOrder(payload: TrackOrderPayload) {
  const res = await fetch("/api/order/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as
      | { message?: string; error?: string; requestId?: string }
      | null;
    const message = data?.message ?? data?.error ?? "Unable to find order";
    const requestId = data?.requestId ? ` (ref: ${data.requestId})` : "";
    throw new Error(`${message}${requestId}`);
  }

  const json = (await res.json().catch(() => null)) as { order?: OrderWithRelations } | null;
  return json?.order ?? null;
}

export function useTrackOrder() {
  return useMutation({
    mutationFn: trackOrder,
  });
}
