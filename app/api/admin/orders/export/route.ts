import { prisma } from "@/lib/prisma";
import { createApiContext, jsonError, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";
import { getAdminSession } from "@/lib/auth/admin";

function csvEscape(value: string) {
  const escaped = value.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

export async function GET(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  try {
    const orders = await prisma.order.findMany({
      include: { shipments: true },
      orderBy: { createdAt: "desc" },
    });

    const header = [
      "orderNumber",
      "email",
      "status",
      "total",
      "currency",
      "createdAt",
      "paymentLinkUrl",
      "paypalInvoiceUrl",
      "trackingNumber",
      "carrier",
    ];
    const lines = orders.map((order) => {
      const shipment = order.shipments[0];
      return [
        order.orderNumber,
        order.email,
        order.status,
        order.total.toString(),
        order.currency,
        order.createdAt.toISOString(),
        order.paymentLinkUrl ?? "",
        order.paypalInvoiceUrl ?? "",
        shipment?.trackingNumber ?? "",
        shipment?.carrier ?? "",
      ].map((value) => csvEscape(String(value ?? ""))).join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");

    logApiSuccess(ctx, 200, { count: orders.length });
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"orders.csv\"",
        "x-request-id": ctx.requestId,
      },
    });
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to export orders", 500, ctx, { code: "ORDER_EXPORT_FAILED" });
  }
}
