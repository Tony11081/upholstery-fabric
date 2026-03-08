"use client";

import { useEffect, useState } from "react";
import { estimateImportFees, guessRegionCode } from "@/lib/utils/fees";

const STORAGE_KEY = "uootd_region";

export function useRegionEstimate(subtotal: number, itemsCount: number) {
  const [regionCode, setRegionCode] = useState<string>("US");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setRegionCode(stored);
      return;
    }
    const guessed = guessRegionCode();
    setRegionCode(guessed);
    window.localStorage.setItem(STORAGE_KEY, guessed);
  }, []);

  const updateRegion = (code: string) => {
    setRegionCode(code);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, code);
    }
  };

  const estimate = estimateImportFees(subtotal, itemsCount, regionCode);

  return { regionCode, updateRegion, estimate };
}
