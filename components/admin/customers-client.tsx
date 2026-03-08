"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";
import { formatPrice } from "@/lib/utils/format";

type Customer = {
  id: string;
  email: string;
  name?: string | null;
  segment?: string | null;
  tags: string[];
  orderCount: number;
  lifetimeValue: string;
  points: number;
  vipTier?: { name: string } | null;
};

export function CustomersClient() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("");
  const [tag, setTag] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (segment) params.set("segment", segment);
      if (tag) params.set("tag", tag);
      const res = await fetch(`/api/admin/customers?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "加载客户失败");
      }
      setCustomers(json.data?.customers ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载客户失败");
    } finally {
      setLoading(false);
    }
  }, [query, segment, tag, toast]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const updateCustomer = async (customerId: string, payload: { tags: string[]; segment: string | null }) => {
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "更新失败");
      }
      toast.success("客户已更新");
      setCustomers((prev) =>
        prev.map((customer) =>
          customer.id === customerId
            ? { ...customer, tags: payload.tags, segment: payload.segment }
            : customer,
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新失败");
    }
  };

  const exportCsv = async () => {
    try {
      const res = await fetch("/api/admin/customers/export");
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error?.message ?? "导出失败");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "客户.csv";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出失败");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="搜索"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="按邮箱或姓名搜索"
        />
        <Input
          label="分层"
          value={segment}
          onChange={(event) => setSegment(event.target.value)}
          placeholder="例如：VIP, 潜客, 复购"
        />
        <Input
          label="标签"
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          placeholder="例如：editorial, vip"
        />
        <Button variant="ghost" onClick={loadCustomers}>
          刷新
        </Button>
        <Button variant="ghost" onClick={exportCsv}>
          导出 CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">客户加载中...</p>
        ) : customers.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无客户数据。</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">客户</th>
                <th className="py-2 pr-2">分层</th>
                <th className="py-2 pr-2">标签</th>
                <th className="py-2 pr-2">订单数</th>
                <th className="py-2 pr-2">LTV</th>
                <th className="py-2 pr-2">积分</th>
                <th className="py-2 pr-2">VIP 等级</th>
                <th className="py-2 pr-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <CustomerRow key={customer.id} customer={customer} onSave={updateCustomer} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CustomerRow({
  customer,
  onSave,
}: {
  customer: Customer;
  onSave: (id: string, payload: { tags: string[]; segment: string | null }) => Promise<void>;
}) {
  const [segment, setSegment] = useState(customer.segment ?? "");
  const [tags, setTags] = useState(customer.tags.join(", "));

  return (
    <tr className="border-b border-border/40 last:border-b-0">
      <td className="py-3 pr-2">
        <div className="flex flex-col">
          <span className="font-medium">{customer.name ?? "客户"}</span>
          <span className="text-xs text-muted">{customer.email}</span>
        </div>
      </td>
      <td className="py-3 pr-2">
        <input
          className="w-32 rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={segment}
          onChange={(event) => setSegment(event.target.value)}
        />
      </td>
      <td className="py-3 pr-2">
        <input
          className="w-48 rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
        />
      </td>
      <td className="py-3 pr-2">{customer.orderCount}</td>
      <td className="py-3 pr-2">{formatPrice(Number(customer.lifetimeValue), "USD")}</td>
      <td className="py-3 pr-2">{customer.points}</td>
      <td className="py-3 pr-2">{customer.vipTier?.name ?? "-"}</td>
      <td className="py-3 pr-2">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() =>
              onSave(customer.id, {
                segment: segment.trim() || null,
                tags: tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
          >
            保存
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/admin/customers/${customer.id}`}>查看</Link>
          </Button>
        </div>
      </td>
    </tr>
  );
}
