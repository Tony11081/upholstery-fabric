import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import { createApiContext, jsonError, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

function toCsvRow(values: Array<string | number | null | undefined>) {
  return values
    .map((value) => {
      if (value === null || value === undefined) return "";
      const text = String(value);
      if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
        return `"${text.replace(/\"/g, "\"\"")}"`;
      }
      return text;
    })
    .join(",");
}

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  try {
    const customers = await prisma.customer.findMany({
      include: { vipTier: true },
      orderBy: { updatedAt: "desc" },
    });

    const header = [
      "email",
      "name",
      "phone",
      "source",
      "utm",
      "preferences",
      "sizes",
      "birthday",
      "segment",
      "tags",
      "orderCount",
      "lifetimeValue",
      "points",
      "vipTier",
      "lastSeenAt",
      "lastOrderAt",
    ];
    const rows = [header.join(",")];
    for (const customer of customers) {
      rows.push(
        toCsvRow([
          customer.email,
          customer.name,
          customer.phone,
          customer.source,
          customer.utm ? JSON.stringify(customer.utm) : "",
          customer.preferences ? JSON.stringify(customer.preferences) : "",
          customer.sizes ? JSON.stringify(customer.sizes) : "",
          customer.birthday?.toISOString() ?? "",
          customer.segment,
          customer.tags.join("|"),
          customer.orderCount,
          Number(customer.lifetimeValue),
          customer.points,
          customer.vipTier?.name ?? "",
          customer.lastSeenAt?.toISOString() ?? "",
          customer.lastOrderAt?.toISOString() ?? "",
        ]),
      );
    }

    const csv = rows.join("\n");
    logApiSuccess(ctx, 200, { count: customers.length });
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=customers.csv",
        "x-request-id": ctx.requestId,
      },
    });
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to export customers", 500, ctx, { code: "CUSTOMER_EXPORT_FAILED" });
  }
}
