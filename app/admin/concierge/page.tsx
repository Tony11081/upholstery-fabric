import { ConciergeClient } from "@/components/admin/concierge-client";
import { AdminAuthState } from "@/components/admin/admin-auth-state";
import { getAuthSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";

export const metadata = {
  title: "后台 - 客服咨询",
};

export default async function ConciergeAdminPage() {
  const session = await getAuthSession();
  const isAdmin = isAdminEmail(session?.user?.email);

  if (!session?.user?.email) {
    return <AdminAuthState variant="signin" callbackUrl="/admin/concierge" />;
  }

  if (!isAdmin) {
    return <AdminAuthState variant="denied" />;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">后台</p>
        <h1 className="font-display text-3xl">客服咨询</h1>
        <p className="text-sm text-muted">管理私享咨询请求。</p>
      </header>
      <ConciergeClient />
    </div>
  );
}
