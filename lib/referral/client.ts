"use client";

export function getStoredReferralCode() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("uootd_ref");
}

export function storeReferralCode(code: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("uootd_ref", code);
  document.cookie = `uootd_ref=${code}; Path=/; Max-Age=2592000; SameSite=Lax`;
}

