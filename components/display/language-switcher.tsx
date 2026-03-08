"use client";

import { useDisplayPricing } from "@/lib/hooks/use-display-pricing";
import { DISPLAY_LANGUAGE_OPTIONS } from "@/lib/utils/display-preferences";

export function LanguageSwitcher() {
  const { profile, setDisplayLanguage } = useDisplayPricing();
  const selected = profile.locale.split("-")[0] || "en";

  return (
    <label className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted">
      <span className="hidden md:inline">Language</span>
      <span className="md:hidden">Lang</span>
      <select
        className="rounded-full border border-border bg-surface px-2 py-1 text-[11px] font-medium tracking-normal text-ink focus:outline-none"
        value={selected}
        onChange={(event) => setDisplayLanguage(event.target.value)}
        aria-label="Select display language"
      >
        {DISPLAY_LANGUAGE_OPTIONS.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
    </label>
  );
}
