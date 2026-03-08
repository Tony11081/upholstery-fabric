import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export type ApiContext = {
  requestId: string;
  startedAt: number;
  method: string;
  path: string;
};

export function createApiContext(request: Request): ApiContext {
  const url = new URL(request.url);
  return {
    requestId: randomUUID(),
    startedAt: Date.now(),
    method: request.method,
    path: url.pathname,
  };
}

export function jsonOk<T extends Record<string, unknown>>(
  data: T,
  ctx: ApiContext,
  init?: ResponseInit,
) {
  return NextResponse.json(
    {
      ok: true,
      data,
      requestId: ctx.requestId,
      ...data,
    },
    {
      ...init,
      headers: {
        "x-request-id": ctx.requestId,
        ...(init?.headers ?? {}),
      },
    },
  );
}

export function jsonError(
  message: string,
  status: number,
  ctx: ApiContext,
  extra?: { code?: string } & Record<string, unknown>,
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: extra?.code ?? "ERROR",
        message,
      },
      message,
      requestId: ctx.requestId,
      ...extra,
    },
    {
      status,
      headers: {
        "x-request-id": ctx.requestId,
      },
    },
  );
}

export function logApiSuccess(ctx: ApiContext, status: number, info?: Record<string, unknown>) {
  const durationMs = Date.now() - ctx.startedAt;
  console.log(`[api] ${ctx.method} ${ctx.path} ${status} ${durationMs}ms ${ctx.requestId}`, info ?? {});
}

export function logApiWarning(ctx: ApiContext, status: number, info?: Record<string, unknown>) {
  const durationMs = Date.now() - ctx.startedAt;
  console.warn(`[api] ${ctx.method} ${ctx.path} ${status} ${durationMs}ms ${ctx.requestId}`, info ?? {});
}

export function logApiError(ctx: ApiContext, status: number, error: unknown, info?: Record<string, unknown>) {
  const durationMs = Date.now() - ctx.startedAt;
  const errorInfo =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { message: String(error) };
  console.error(`[api] ${ctx.method} ${ctx.path} ${status} ${durationMs}ms ${ctx.requestId}`, {
    ...info,
    error: errorInfo,
  });
}

export function maskEmail(email?: string | null) {
  if (!email) return undefined;
  const [, domain] = email.split("@");
  return domain ? `***@${domain}` : "***";
}
