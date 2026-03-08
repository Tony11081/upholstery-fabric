import { OrderDetailClient } from "@/components/admin/order-detail-client";
import { getAuthSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import { AdminAuthState } from "@/components/admin/admin-auth-state";

export const metadata = {
  title: "后台 - 订单详情",
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getAuthSession();
  const isAdmin = isAdminEmail(session?.user?.email);

  if (!session?.user?.email) {
    return <AdminAuthState variant="signin" callbackUrl={`/admin/orders/${id}`} />;
  }

  if (!isAdmin) {
    return <AdminAuthState variant="denied" />;
  }

  return <OrderDetailClient orderId={id} />;
}


