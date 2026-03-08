import { headers } from "next/headers";
import { createApiContext, jsonError, type ApiContext } from "@/lib/utils/api";

export type BotAuthResult =
  | { authorized: true; ctx: ApiContext }
  | { authorized: false; response: Response };

/**
 * Authenticate Bot API requests using BOT_API_TOKEN.
 * Supports:
 * - Header: x-bot-token: <token>
 * - Header: authorization: Bearer <token>
 */
export async function authenticateBotRequest(
  request: Request,
): Promise<BotAuthResult> {
  const ctx = createApiContext(request);
  const token = process.env.BOT_API_TOKEN;

  if (!token) {
    console.error("[bot-api] BOT_API_TOKEN not configured");
    return {
      authorized: false,
      response: jsonError("Bot API not configured", 500, ctx, {
        code: "BOT_API_NOT_CONFIGURED",
      }),
    };
  }
  const allowedTokens = token
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const headerStore = await headers();
  const botToken = headerStore.get("x-bot-token");
  const authHeader = headerStore.get("authorization");

  let providedToken: string | null = null;

  if (botToken) {
    providedToken = botToken;
  } else if (authHeader?.startsWith("Bearer ")) {
    providedToken = authHeader.slice(7);
  }

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
