"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

type Order = {
  id: string;
  orderNumber: string;
  email: string;
  status: string;
  total: string;
  currency: string;
  createdAt: string;
  items: Array<{ id: string }>;
};

const orderStatusLabel: Record<string, string> = {
  PENDING: "待处理",
  AWAITING_PAYMENT_LINK: "等待付款链接",
  CONFIRMED: "已确认",
  PROCESSING: "处理中",
  SHIPPED: "已发货",
  DELIVERED: "已送达",
  CANCELED: "已取消",
};

export function OrdersClient() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "加载订单失败");
      }
      setOrders(json.data?.orders ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载订单失败");
    } finally {
      setLoading(false);
    }
  }, [query, status, toast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const downloadExport = async () => {
    try {
      const res = await fetch("/api/admin/orders/export");
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error?.message ?? "导出失败");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "订单.csv";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出失败");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          label="搜索"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="按订单号或邮箱搜索"
        />
        <label className="flex flex-col gap-2 text-sm text-ink">
          <span className="font-medium text-ink">状态</span>
          <select
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">全部</option>
            <option value="PENDING">待处理</option>
            <option value="AWAITING_PAYMENT_LINK">等待付款链接</option>
            <option value="CONFIRMED">已确认</option>
            <option value="PROCESSING">处理中</option>
            <option value="SHIPPED">已发货</option>
            <option value="DELIVERED">已送达</option>
            <option value="CANCELED">已取消</option>
          </select>
        </label>
        <Button variant="ghost" onClick={loadOrders}>
          刷新
        </Button>
        <Button variant="ghost" onClick={downloadExport}>
          导出 CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">订单加载中...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无订单。</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">订单号</th>
                <th className="py-2 pr-2">邮箱</th>
                <th className="py-2 pr-2">状态</th>
                <th className="py-2 pr-2">金额</th>
                <th className="py-2 pr-2">商品数</th>
                <th className="py-2 pr-2">日期</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-border/40">
                  <td className="py-3 pr-2">
                    <Link href={`/admin/orders/${order.id}`} className="underline underline-offset-4">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="py-3 pr-2">{order.email}</td>
                  <td className="py-3 pr-2">{orderStatusLabel[order.status] ?? order.status}</td>
                  <td className="py-3 pr-2">
                    {order.currency} {order.total}
                  </td>
                  <td className="py-3 pr-2">{order.items?.length ?? 0}</td>
                  <td className="py-3 pr-2">{new Date(order.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
