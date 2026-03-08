import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getAuthSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import { AdminAuthState } from "@/components/admin/admin-auth-state";
import { AdminTokenGate } from "@/components/admin/admin-token-gate";

const navItems = [
  { href: "/admin", label: "总览" },
  { href: "/admin/customers", label: "客户" },
  { href: "/admin/categories", label: "分类" },
  { href: "/admin/products", label: "商品" },
  { href: "/admin/discounts", label: "折扣" },
  { href: "/admin/coupons", label: "优惠券" },
  { href: "/admin/orders", label: "订单" },
  { href: "/admin/aftercare", label: "售后" },
  { href: "/admin/concierge", label: "客服咨询" },
  { href: "/admin/requests", label: "付款请求" },
  { href: "/admin/referrals", label: "推荐" },
  { href: "/admin/reviews", label: "评价" },
  { href: "/admin/vip", label: "VIP" },
  { href: "/admin/automations", label: "自动化" },
  { href: "/admin/experiments", label: "实验" },
  { href: "/admin/content", label: "内容" },
  { href: "/admin/subscriptions", label: "订阅" },
  { href: "/admin/analytics", label: "分析" },
  { href: "/admin/email", label: "邮件发送" },
];

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAuthSession();
  const isAdmin = isAdminEmail(session?.user?.email);
  const token = process.env.ADMIN_PAYMENT_LINK_TOKEN;
  const tokenEnabled = Boolean(token);

  if (!session?.user?.email) {
    return (
      <div className="min-h-screen bg-background px-4 pb-20 pt-10 sm:px-6 md:px-8">
        <div className="space-y-4">
          <AdminAuthState variant="signin" callbackUrl="/admin" />
          {tokenEnabled ? <AdminTokenGate /> : null}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background px-4 pb-20 pt-10 sm:px-6 md:px-8">
        <div className="space-y-4">
          <AdminAuthState variant="denied" />
          {tokenEnabled ? <AdminTokenGate /> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-surface/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">后台</p>
            <h1 className="text-lg font-medium">UOOTD 管理控制台</h1>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="underline-offset-4 hover:underline">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">{children}</main>
    </div>
  );
}
