import { Suspense } from "react";
import { RequestsClient } from "@/components/admin/requests-client";
import { getAuthSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import { AdminAuthState } from "@/components/admin/admin-auth-state";

export const metadata = {
  title: "后台 - 付款请求",
};

export default async function AdminRequestsPage() {
  const session = await getAuthSession();
  const isAdmin = isAdminEmail(session?.user?.email);

  if (!session?.user?.email) {
    return <AdminAuthState variant="signin" callbackUrl="/admin/requests" />;
  }

  if (!isAdmin) {
    return <AdminAuthState variant="denied" />;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">后台</p>
        <h1 className="font-display text-3xl leading-tight">待处理付款链接</h1>
        <p className="text-sm text-muted">
          粘贴 PayPal 账单链接或托管支付链接（需管理员权限）。
        </p>
      </div>
      <Suspense fallback={<div className="text-sm text-muted">加载中...</div>}>
        <RequestsClient />
      </Suspense>
    </div>
  );
}


