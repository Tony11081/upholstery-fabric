import { isProd } from "@/lib/utils/env";

export const BRAND_NAME = "ATELIER FABRICS";
export const DEFAULT_OG_IMAGE = "/og-default.svg";
export const DEFAULT_SITE_URL = "https://upholsteryfabric.net";

const LOCAL_SITE_URL = "http://localhost:3000";

function normalizeUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function withProtocol(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function toOrigin(value: string) {
  return normalizeUrl(new URL(withProtocol(value.trim())).origin);
}

export function getSiteUrl(fallback?: string) {
  const defaultUrl = isProd ? DEFAULT_SITE_URL : LOCAL_SITE_URL;
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    fallback,
    defaultUrl,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return toOrigin(candidate);
    } catch {
      continue;
    }
  }

  return normalizeUrl(defaultUrl);
}

export function absoluteUrl(path = "/", fallback?: string) {
  return new URL(path, getSiteUrl(fallback)).toString();
}
