"use client";

import { useDisplayPricing } from "@/lib/hooks/use-display-pricing";
import { DISPLAY_CURRENCY_OPTIONS } from "@/lib/utils/display-preferences";

export function CurrencySwitcher() {
  const { profile, setDisplayCurrency } = useDisplayPricing();
  const selected = profile.currency || "USD";

  return (
    <label className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted">
      <span className="hidden md:inline">Currency</span>
      <span className="md:hidden">FX</span>
      <select
        className="rounded-full border border-border bg-surface px-2 py-1 text-[11px] font-medium tracking-normal text-ink focus:outline-none"
        value={selected}
        onChange={(event) => setDisplayCurrency(event.target.value)}
        aria-label="Select display currency"
      >
        {DISPLAY_CURRENCY_OPTIONS.map((currency) => (
          <option key={currency} value={currency}>
            {currency}
          </option>
        ))}
      </select>
    </label>
  );
}
