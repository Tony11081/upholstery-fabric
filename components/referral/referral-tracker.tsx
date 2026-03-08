"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { storeReferralCode } from "@/lib/referral/client";

export function ReferralTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code =
      searchParams.get("ref") ||
      searchParams.get("invite") ||
      searchParams.get("referral");
    if (code) {
      storeReferralCode(code);
    }
  }, [searchParams]);

  return null;
}

