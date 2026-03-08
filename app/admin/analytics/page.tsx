import { Suspense } from "react";
import { AnalyticsClient } from "@/components/admin/analytics-client";
import { getAuthSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import { AdminAuthState } from "@/components/admin/admin-auth-state";

export const metadata = {
  title: "后台 - 数据分析",
};

export default async function AdminAnalyticsPage() {
  const session = await getAuthSession();
  const isAdmin = isAdminEmail(session?.user?.email);

  if (!session?.user?.email) {
    return <AdminAuthState variant="signin" callbackUrl="/admin/analytics" />;
  }

  if (!isAdmin) {
    return <AdminAuthState variant="denied" />;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">后台</p>
        <h1 className="font-display text-3xl leading-tight">数据分析</h1>
        <p className="text-sm text-muted">监控转化、留存与用户分层趋势。</p>
      </div>
      <Suspense fallback={<div className="text-sm text-muted">加载中...</div>}>
        <AnalyticsClient />
      </Suspense>
    </div>
  );
}
