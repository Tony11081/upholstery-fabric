import { createApiContext, jsonError, type ApiContext } from "@/lib/utils/api";

export type OpenClawBridgeAuthResult =
  | { authorized: true; ctx: ApiContext }
  | { authorized: false; response: Response };

/**
 * Authenticate internal OpenClaw bridge requests using OPENCLAW_BRIDGE_TOKEN.
 *
 * Supports:
 * - Header: x-bridge-token: <token>
 * - Header: authorization: Bearer <token>
 */
export async function authenticateOpenClawBridgeRequest(
  request: Request,
): Promise<OpenClawBridgeAuthResult> {
  const ctx = createApiContext(request);
  const token = (process.env.OPENCLAW_BRIDGE_TOKEN ?? "").trim();

  if (!token) {
    console.error("[openclaw-bridge] OPENCLAW_BRIDGE_TOKEN not configured");
    return {
      authorized: false,
      response: jsonError("Not found", 404, ctx, {
        code: "NOT_FOUND",
      }),
    };
  }

  const allowedTokens = token
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const providedToken =
    request.headers.get("x-bridge-token") ??
    (request.headers.get("authorization")?.startsWith("Bearer ")
      ? request.headers.get("authorization")?.slice(7)
      : null);

  if (!providedToken) {
    return {
      authorized: false,
      response: jsonError("Missing authentication token", 401, ctx, {
        code: "MISSING_TOKEN",
      }),
    };
  }

  if (!allowedTokens.includes(providedToken)) {
    return {
      authorized: false,
      response: jsonError("Invalid authentication token", 401, ctx, {
        code: "INVALID_TOKEN",
      }),
    };
  }

  return { authorized: true, ctx };
}

