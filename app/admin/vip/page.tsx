import { VipTiersClient } from "@/components/admin/vip-tiers-client";
import { getAuthSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import { AdminAuthState } from "@/components/admin/admin-auth-state";

export const metadata = {
  title: "后台 - VIP",
  robots: { index: false, follow: false },
};

export default async function AdminVipPage() {
  const session = await getAuthSession();
  const isAdmin = isAdminEmail(session?.user?.email);

  if (!session?.user?.email) {
    return <AdminAuthState variant="signin" callbackUrl="/admin/vip" />;
  }

  if (!isAdmin) {
    return <AdminAuthState variant="denied" />;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">后台</p>
        <h1 className="font-display text-3xl">VIP 与会员积分</h1>
        <p className="text-sm text-muted">配置等级门槛、权益与积分规则。</p>
      </header>
      <VipTiersClient />
    </div>
  );
}

