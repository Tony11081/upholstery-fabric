const PROXY_PREFIX = "/api/image?url=";

export function resolveImageUrl(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(PROXY_PREFIX) || trimmed.includes(`${PROXY_PREFIX}`)) return trimmed;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  const normalized = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return `${PROXY_PREFIX}${encodeURIComponent(normalized)}`;
  }
  return trimmed;
}
