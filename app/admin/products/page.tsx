import { Suspense } from "react";
import { getAuthSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import { ProductsClient } from "@/components/admin/products-client";
import { AdminAuthState } from "@/components/admin/admin-auth-state";

export const metadata = {
  title: "后台 - 商品",
};

export default async function AdminProductsPage() {
  const session = await getAuthSession();
  const isAdmin = isAdminEmail(session?.user?.email);

  if (!session?.user?.email) {
    return <AdminAuthState variant="signin" callbackUrl="/admin/products" />;
  }

  if (!isAdmin) {
    return <AdminAuthState variant="denied" />;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">后台</p>
        <h1 className="font-display text-3xl leading-tight">商品管理</h1>
        <p className="text-sm text-muted">管理商品、批量更新与 CSV/Excel 导入。</p>
      </div>
      <Suspense fallback={<div className="text-sm text-muted">加载中...</div>}>
        <ProductsClient />
      </Suspense>
    </div>
  );
}

