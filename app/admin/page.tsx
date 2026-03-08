import Link from "next/link";
import { getAuthSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/admin";
import { AdminAuthState } from "@/components/admin/admin-auth-state";
import { InflywayHealthCard } from "@/components/admin/inflyway-health-card";

export const metadata = {
  title: "后台",
};

const cards = [
  { href: "/admin/customers", title: "客户", description: "统一管理客户档案、标签与跟进记录。" },
  { href: "/admin/categories", title: "分类", description: "维护商品分类与层级结构。" },
  { href: "/admin/products", title: "商品", description: "创建、编辑并批量更新商品目录。" },
  { href: "/admin/discounts", title: "折扣", description: "管理全局、分类和单品折扣策略。" },
  { href: "/admin/coupons", title: "优惠券", description: "创建并发送优惠券活动。" },
  { href: "/admin/orders", title: "订单", description: "查看订单、更新状态并导出 CSV。" },
  { href: "/admin/aftercare", title: "售后", description: "跟踪退货、换货与售后工单。" },
  { href: "/admin/concierge", title: "客服咨询", description: "管理私享咨询请求。" },
  { href: "/admin/requests", title: "付款请求", description: "为发票模式订单发送付款链接。" },
  { href: "/admin/referrals", title: "推荐", description: "管理推荐码与分销推广数据。" },
  { href: "/admin/reviews", title: "评价", description: "审核用户评价与口碑内容。" },
  { href: "/admin/vip", title: "VIP", description: "配置会员等级、积分与权益。" },
  { href: "/admin/automations", title: "自动化", description: "设置生命周期触发器与模板。" },
  { href: "/admin/experiments", title: "实验", description: "运行核心流程 A/B 实验。" },
  { href: "/admin/content", title: "内容", description: "发布内容专题与上新日历。" },
  { href: "/admin/subscriptions", title: "订阅", description: "监控上新提醒与库存提醒。" },
  { href: "/admin/analytics", title: "分析", description: "跟踪转化与留存关键指标。" },
];

export default async function AdminOverviewPage() {
  const session = await getAuthSession();
  const isAdmin = isAdminEmail(session?.user?.email);

  if (!session?.user?.email) {
    return <AdminAuthState variant="signin" callbackUrl="/admin" />;
  }

  if (!isAdmin) {
    return <AdminAuthState variant="denied" />;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">后台</p>
        <h1 className="font-display text-3xl">总览</h1>
        <p className="text-sm text-muted">快速访问电商运营功能。</p>
      </header>

      <InflywayHealthCard />

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-border/80"
          >
            <h2 className="text-lg font-medium">{card.title}</h2>
            <p className="mt-2 text-sm text-muted">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
