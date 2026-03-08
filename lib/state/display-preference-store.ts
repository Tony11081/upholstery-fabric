"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  inferCountryFromLocale,
  normalizeDisplayLanguage,
  type DisplayLanguage,
} from "@/lib/utils/display-preferences";

type DisplayPreferenceState = {
  countryCode: string;
  displayCurrency: string;
  displayLanguage: DisplayLanguage | "";
  setCountry: (countryCode: string) => void;
  setDisplayCurrency: (currency: string) => void;
  setDisplayLanguage: (language: string) => void;
  bootstrap: (localeHint?: string, timezoneHint?: string) => void;
};

const fallbackStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
};

export const useDisplayPreferenceStore = create<DisplayPreferenceState>()(
  persist(
    (set, get) => ({
      countryCode: "",
      displayCurrency: "",
      displayLanguage: "",
      setCountry: (countryCode) => {
        const normalized = countryCode.trim().toUpperCase();
        if (!normalized) return;
        set({ countryCode: normalized });
      },
      setDisplayCurrency: (currency) => {
        const normalized = currency.trim().toUpperCase();
        if (!normalized) {
          set({ displayCurrency: "" });
          return;
        }
        set({ displayCurrency: normalized });
      },
      setDisplayLanguage: (language) => {
        const normalized = normalizeDisplayLanguage(language);
        set({ displayLanguage: normalized });
      },
      bootstrap: (localeHint, timezoneHint) => {
        if (get().countryCode) return;
        const inferred = inferCountryFromLocale(localeHint, timezoneHint);
        const inferredLanguage = normalizeDisplayLanguage(localeHint);
        set({ countryCode: inferred, displayLanguage: inferredLanguage || "" });
      },
    }),
    {
      name: "uootd-display-preference",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? fallbackStorage : localStorage,
      ),
      version: 1,
    },
  ),
);
