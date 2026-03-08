import { getAuthSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import { AdminAuthState } from "@/components/admin/admin-auth-state";
import { CategoriesClient } from "@/components/admin/categories-client";

export const metadata = {
  title: "后台 - 分类",
};

export default async function AdminCategoriesPage() {
  const session = await getAuthSession();
  const isAdmin = isAdminEmail(session?.user?.email);

  if (!session?.user?.email) {
    return <AdminAuthState variant="signin" callbackUrl="/admin/categories" />;
  }

  if (!isAdmin) {
    return <AdminAuthState variant="denied" />;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">后台</p>
        <h1 className="font-display text-3xl">分类</h1>
        <p className="text-sm text-muted">
          创建并管理商品目录分类结构。
        </p>
      </header>
      <CategoriesClient />
    </div>
  );
}


