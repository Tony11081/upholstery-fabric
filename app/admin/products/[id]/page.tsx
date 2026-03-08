import { ProductForm } from "@/components/admin/product-form";
import { getAuthSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import { AdminAuthState } from "@/components/admin/admin-auth-state";

export const metadata = {
  title: "后台 - 编辑商品",
};

export default async function AdminProductDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getAuthSession();
  const isAdmin = isAdminEmail(session?.user?.email);

  if (!session?.user?.email) {
    return <AdminAuthState variant="signin" callbackUrl={`/admin/products/${id}`} />;
  }

  if (!isAdmin) {
    return <AdminAuthState variant="denied" />;
  }

  return <ProductForm productId={id} />;
}


