"use client";

type UtmPayload = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
};

const STORAGE_KEY = "uootd_utm";

export function captureUtmFromParams(params: URLSearchParams | null) {
  if (!params) return;
  if (typeof window === "undefined") return;
  const payload: UtmPayload = {
    source: params.get("utm_source") ?? undefined,
    medium: params.get("utm_medium") ?? undefined,
    campaign: params.get("utm_campaign") ?? undefined,
    content: params.get("utm_content") ?? undefined,
    term: params.get("utm_term") ?? undefined,
  };

  const hasUtm = Object.values(payload).some(Boolean);
  if (!hasUtm) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }

  const cookieValue = encodeURIComponent(JSON.stringify(payload));
  document.cookie = `${STORAGE_KEY}=${cookieValue}; Path=/; Max-Age=2592000; SameSite=Lax`;
}

export function getStoredUtm(): UtmPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UtmPayload;
  } catch {
    return null;
  }
}
