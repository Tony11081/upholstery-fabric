export function isOpenClawAdminRequest(request: Request): boolean {
  const tokenRaw = (process.env.OPENCLAW_ADMIN_TOKEN ?? "").trim();
  if (!tokenRaw) return false;

  const allowedTokens = tokenRaw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!allowedTokens.length) return false;

  const provided =
    request.headers.get("x-openclaw-token") ??
    (request.headers.get("authorization")?.startsWith("Bearer ")
      ? request.headers.get("authorization")?.slice(7)
      : null);

  if (!provided) return false;
  return allowedTokens.includes(provided.trim());
}
