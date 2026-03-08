import { Suspense } from "react";
import { DiscountsClient } from "@/components/admin/discounts-client";
import { getAuthSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import { AdminAuthState } from "@/components/admin/admin-auth-state";

export const metadata = {
  title: "后台 - 折扣",
};

export default async function AdminDiscountsPage() {
  const session = await getAuthSession();
  const isAdmin = isAdminEmail(session?.user?.email);

  if (!session?.user?.email) {
    return <AdminAuthState variant="signin" callbackUrl="/admin/discounts" />;
  }

  if (!isAdmin) {
    return <AdminAuthState variant="denied" />;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">后台</p>
        <h1 className="font-display text-3xl leading-tight">折扣</h1>
        <p className="text-sm text-muted">管理全站、分类和单品折扣。</p>
      </div>
      <Suspense fallback={<div className="text-sm text-muted">加载中...</div>}>
        <DiscountsClient />
      </Suspense>
    </div>
  );
}


