import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import { AdminAuthState } from "@/components/admin/admin-auth-state";
import { CustomerDetailClient } from "@/components/admin/customer-detail-client";

export const metadata = {
  title: "后台 - 客户详情",
  robots: { index: false, follow: false },
};

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getAuthSession();
  const isAdmin = isAdminEmail(session?.user?.email);

  if (!session?.user?.email) {
    return <AdminAuthState variant="signin" callbackUrl={`/admin/customers/${id}`} />;
  }

  if (!isAdmin) {
    return <AdminAuthState variant="denied" />;
  }

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      vipTier: true,
      orders: { orderBy: { createdAt: "desc" }, take: 10 },
      notes: { orderBy: { createdAt: "desc" }, take: 20 },
      followUps: { orderBy: { createdAt: "desc" }, take: 20 },
      events: { orderBy: { occurredAt: "desc" }, take: 20 },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { product: true, category: true },
      },
    },
  });

  if (!customer) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <h1 className="font-display text-2xl">未找到客户</h1>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">后台</p>
        <h1 className="font-display text-3xl">客户资料</h1>
        <p className="text-sm text-muted">{customer.email}</p>
      </header>
      <CustomerDetailClient customer={JSON.parse(JSON.stringify(customer))} />
    </div>
  );
}
