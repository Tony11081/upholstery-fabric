"use client";

import { useDisplayPricing } from "@/lib/hooks/use-display-pricing";

type PriceProps = {
  amount: number;
  currency?: string;
  className?: string;
};

export function Price({ amount, currency = "USD", className }: PriceProps) {
  const { formatAmount } = useDisplayPricing();
  const display = formatAmount(amount, currency);
  const title = display.converted && display.usdText
    ? `Approximate local display. Charged in USD (${display.usdText}).`
    : undefined;
  return (
    <span className={className} title={title}>
      {display.text}
    </span>
  );
}
