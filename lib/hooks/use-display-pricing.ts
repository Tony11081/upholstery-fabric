"use client";

import { useEffect, useMemo } from "react";
import { useDisplayPreferenceStore } from "@/lib/state/display-preference-store";
import {
  convertUsdToCurrency,
  resolveDisplayProfile,
  resolveLanguageLabel,
  resolveLocaleByLanguage,
} from "@/lib/utils/display-preferences";
import { formatPrice } from "@/lib/utils/format";

type DisplayAmount = {
  text: string;
  converted: boolean;
  usdText?: string;
};

export function useDisplayPricing() {
  const countryCode = useDisplayPreferenceStore((state) => state.countryCode);
  const displayCurrency = useDisplayPreferenceStore((state) => state.displayCurrency);
  const displayLanguage = useDisplayPreferenceStore((state) => state.displayLanguage);
  const setCountry = useDisplayPreferenceStore((state) => state.setCountry);
  const setDisplayCurrency = useDisplayPreferenceStore((state) => state.setDisplayCurrency);
  const setDisplayLanguage = useDisplayPreferenceStore((state) => state.setDisplayLanguage);
  const bootstrap = useDisplayPreferenceStore((state) => state.bootstrap);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    bootstrap(navigator.language, timezone);
  }, [bootstrap]);

  const profile = useMemo(() => {
    const localeHint = typeof navigator !== "undefined" ? navigator.language : undefined;
    const timezoneHint = typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined;
    return resolveDisplayProfile({
      countryCode,
      localeHint,
      timezoneHint,
    });
  }, [countryCode]);

  const effectiveProfile = useMemo(
    () => ({
      ...profile,
      locale: resolveLocaleByLanguage(displayLanguage, profile.countryCode, profile.locale),
      languageLabel: resolveLanguageLabel(displayLanguage, profile.languageLabel),
      currency: displayCurrency || profile.currency,
    }),
    [displayCurrency, displayLanguage, profile],
  );

  const formatAmount = (amount: number, baseCurrency = "USD"): DisplayAmount => {
    const safeCurrency = (baseCurrency || "USD").toUpperCase();
    if (safeCurrency === "USD" && effectiveProfile.currency !== "USD") {
      const converted = convertUsdToCurrency(amount, effectiveProfile.currency);
      return {
        text: `≈ ${formatPrice(converted, effectiveProfile.currency, effectiveProfile.locale)}`,
        usdText: formatPrice(amount, "USD", "en-US"),
        converted: true,
      };
    }

    return {
      text: formatPrice(amount, safeCurrency, effectiveProfile.locale),
      converted: false,
    };
  };

  return {
    profile: effectiveProfile,
    setCountry,
    setDisplayCurrency,
    setDisplayLanguage,
    formatAmount,
  };
}
