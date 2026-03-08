"use client";

import { useEffect } from "react";
import { useDisplayPreferenceStore } from "@/lib/state/display-preference-store";
import {
  resolveDisplayProfile,
  resolveLocaleByLanguage,
  normalizeDisplayLanguage,
} from "@/lib/utils/display-preferences";

export function DisplayPreferenceBootstrap() {
  const countryCode = useDisplayPreferenceStore((state) => state.countryCode);
  const displayLanguage = useDisplayPreferenceStore((state) => state.displayLanguage);
  const setDisplayLanguage = useDisplayPreferenceStore((state) => state.setDisplayLanguage);
  const bootstrap = useDisplayPreferenceStore((state) => state.bootstrap);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    bootstrap(navigator.language, timezone);
  }, [bootstrap]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (displayLanguage) return;
    const inferredLanguage = normalizeDisplayLanguage(navigator.language);
    if (!inferredLanguage) return;
    setDisplayLanguage(inferredLanguage);
  }, [displayLanguage, setDisplayLanguage]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const profile = resolveDisplayProfile({ countryCode });
    const locale = resolveLocaleByLanguage(displayLanguage, profile.countryCode, profile.locale);
    const language = locale.split("-")[0] || "en";
    document.documentElement.setAttribute("lang", language);
  }, [countryCode, displayLanguage]);

  return null;
}
