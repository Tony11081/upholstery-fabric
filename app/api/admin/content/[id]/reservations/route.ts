import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/admin";
import {
  createApiContext,
  jsonError,
  jsonOk,
  logApiError,
  logApiSuccess,
  logApiWarning,
} from "@/lib/utils/api";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  const { id } = await params;
  try {
    const reservations = await prisma.dropReservation.findMany({
      where: { contentId: id },
      orderBy: { createdAt: "desc" },
      include: { customer: true, content: true },
    });

    logApiSuccess(ctx, 200, { count: reservations.length });
    return jsonOk(
      {
        reservations: reservations.map((reservation) => ({
          id: reservation.id,
          email: reservation.email,
          status: reservation.status,
          createdAt: reservation.createdAt,
          customerId: reservation.customerId,
          customerName: reservation.customer?.name ?? null,
        })),
      },
      ctx,
    );
  } catch (error) {
    logApiError(ctx, 500, error, { id });
    return jsonError("Unable to load reservations", 500, ctx, { code: "RESERVATIONS_FAILED" });
  }
}
