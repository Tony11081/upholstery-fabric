import { ReferralsClient } from "@/components/admin/referrals-client";
import { getAuthSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import { AdminAuthState } from "@/components/admin/admin-auth-state";

export const metadata = {
  title: "后台 - 推荐",
  robots: { index: false, follow: false },
};

export default async function AdminReferralsPage() {
  const session = await getAuthSession();
  const isAdmin = isAdminEmail(session?.user?.email);

  if (!session?.user?.email) {
    return <AdminAuthState variant="signin" callbackUrl="/admin/referrals" />;
  }

  if (!isAdmin) {
    return <AdminAuthState variant="denied" />;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">后台</p>
        <h1 className="font-display text-3xl">推荐管理</h1>
        <p className="text-sm text-muted">管理邀请码与分销推广追踪。</p>
      </header>
      <ReferralsClient />
    </div>
  );
}
