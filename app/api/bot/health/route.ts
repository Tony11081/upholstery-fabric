import { authenticateBotRequest } from "@/lib/auth/bot";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, logApiError, logApiSuccess } from "@/lib/utils/api";

function getVersion() {
  return (
    process.env.NEXT_PUBLIC_APP_VERSION ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GIT_SHA ??
    "unknown"
  );
}

export async function GET(request: Request) {
  const auth = await authenticateBotRequest(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const { ctx } = auth;
  const version = getVersion();
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;
    logApiSuccess(ctx, 200, { db: "ok", version });
    return jsonOk({ status: "ok", db: "ok", version, timestamp }, ctx);
  } catch (error) {
    logApiError(ctx, 503, error, { db: "error", version });
    return jsonError("Database unavailable", 503, ctx, {
      code: "DB_UNAVAILABLE",
      status: "degraded",
      db: "error",
      version,
      timestamp,
    });
  }
}
