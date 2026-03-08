import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

type Body = {
  name?: string;
  phone?: string;
  birthday?: string;
  locale?: string;
  preferences?: Prisma.InputJsonValue;
  sizes?: Prisma.InputJsonValue;
};

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAuthSession();
  if (!session?.user?.email) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_json" });
    return jsonError("Invalid request body", 400, ctx, { code: "INVALID_BODY" });
  }

  const email = session.user.email.toLowerCase();
  let birthday: Date | null | undefined;
  if (body.birthday !== undefined) {
    const value = typeof body.birthday === "string" ? body.birthday.trim() : "";
    if (!value) {
      birthday = null;
    } else {
      const parsed = new Date(value);
      birthday = Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
  }

  try {
    const customer = await prisma.customer.upsert({
      where: { email },
      create: {
        email,
        name: body.name ?? session.user.name ?? undefined,
        phone: body.phone ?? undefined,
        birthday: birthday === undefined ? undefined : birthday,
        locale: body.locale ?? undefined,
        preferences: body.preferences ?? undefined,
        sizes: body.sizes ?? undefined,
        lastSeenAt: new Date(),
      },
      update: {
        name: body.name ?? undefined,
        phone: body.phone ?? undefined,
        birthday,
        locale: body.locale ?? undefined,
        preferences: body.preferences ?? undefined,
        sizes: body.sizes ?? undefined,
        lastSeenAt: new Date(),
      },
    });

    if (body.name) {
      await prisma.user.update({
        where: { email },
        data: { name: body.name },
      });
    }

    logApiSuccess(ctx, 200, { customerId: customer.id });
    return jsonOk({ customer }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to update profile", 500, ctx, { code: "PROFILE_UPDATE_FAILED" });
  }
}
