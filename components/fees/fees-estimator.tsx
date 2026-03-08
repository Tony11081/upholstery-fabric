"use client";

import { useMemo } from "react";
import { formatPrice } from "@/lib/utils/format";
import { REGION_CONFIGS } from "@/lib/utils/fees";
import { useRegionEstimate } from "@/lib/hooks/useRegionEstimate";

type FeesEstimatorProps = {
  subtotal: number;
  itemsCount: number;
  currency?: string;
};

export function FeesEstimator({ subtotal, itemsCount, currency = "USD" }: FeesEstimatorProps) {
  const { regionCode, updateRegion, estimate } = useRegionEstimate(subtotal, itemsCount);
  const regionLabel = useMemo(() => {
    return REGION_CONFIGS.find((region) => region.code === regionCode)?.label ?? regionCode;
  }, [regionCode]);

  if (subtotal <= 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Shipping estimate</p>
          <p className="text-sm text-muted">
            Based on {regionLabel}. Final charge will be shown on the official checkout page.
          </p>
        </div>
        <select
          className="rounded-full border border-border bg-contrast px-3 py-2 text-xs text-ink"
          value={regionCode}
          onChange={(event) => updateRegion(event.target.value)}
        >
          {REGION_CONFIGS.map((region) => (
            <option key={region.code} value={region.code}>
              {region.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 space-y-2 text-sm text-muted">
        <div className="flex items-center justify-between">
          <span>Tracked shipping (est.)</span>
          <span className="text-ink">{formatPrice(estimate.shipping, currency)}</span>
        </div>
        <div className="flex items-center justify-between text-base font-semibold">
          <span>Estimated total</span>
          <span>{formatPrice(subtotal + estimate.shipping, currency)}</span>
        </div>
      </div>
    </div>
  );
}
