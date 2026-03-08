"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils/format";
import { useToast } from "@/lib/hooks/useToast";

type RequestItem = {
  id: string;
  orderNumber: string;
  email: string;
  subtotal: string | number;
  currency: string;
  createdAt?: string;
  items: Array<{ id: string; titleSnapshot: string | null; qty: number; price: string | number; currency: string }>;
};

export function RequestsClient() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RequestItem | null>(null);
  const [link, setLink] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/purchase/requests");
      const data = (await res.json().catch(() => null)) as
        | { requests?: RequestItem[]; error?: string; message?: string; requestId?: string }
        | null;
      if (!res.ok) {
        const message = data?.message ?? data?.error ?? "加载付款请求失败";
        const requestId = data?.requestId ? ` (ref: ${data.requestId})` : "";
        throw new Error(`${message}${requestId}`);
      }
      setRequests(data?.requests ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载付款请求失败";
      setError(message);
      toast({
        title: "加载付款请求失败",
        description: message,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const submitLink = async () => {
    if (!selected) return;
    setMessage(null);
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/purchase/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderNumber: selected.orderNumber,
          paypalInvoiceUrl: link,
          paymentLinkUrl: link,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; message?: string; requestId?: string }
        | null;
      if (!res.ok) {
        const message = data?.message ?? data?.error ?? "发送付款链接失败";
        const requestId = data?.requestId ? ` (ref: ${data.requestId})` : "";
        throw new Error(`${message}${requestId}`);
      }
      setMessage("付款链接已发送");
      setLink("");
      toast({
        title: "付款链接已发送",
        description: selected.orderNumber,
        variant: "success",
      });
      await fetchRequests();
    } catch (err) {
      const message = err instanceof Error ? err.message : "发送付款链接失败";
      setError(message);
      toast({
        title: "发送付款链接失败",
        description: message,
        variant: "error",
      });
    } finally {
      setSending(false);
    }
  };

  const selectedItems = useMemo(() => selected?.items ?? [], [selected]);

  return (
    <div className="grid gap-6 md:grid-cols-[260px,1fr]">
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">付款请求</p>
        <Button className="w-full rounded-full" onClick={fetchRequests} loading={loading}>
          加载请求
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">等待付款链接</p>
            <span className="text-xs text-muted">{requests.length} 条待处理</span>
          </div>
          <div className="divide-y divide-border">
            {requests.length === 0 && <p className="p-4 text-sm text-muted">暂无待处理请求。</p>}
            {requests.map((req) => (
              <button
                key={req.id}
                className={`w-full text-left transition hover:bg-contrast ${selected?.id === req.id ? "bg-contrast" : ""}`}
                onClick={() => {
                  setSelected(req);
                  setLink("");
                  setMessage(null);
                  setError(null);
                }}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{req.orderNumber}</p>
                    <p className="text-xs text-muted">{req.email}</p>
                  </div>
                  <div className="text-sm font-medium">
                    {formatPrice(Number(req.subtotal), req.currency ?? "USD")}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted">请求详情</p>
                <p className="text-lg font-semibold">{selected.orderNumber}</p>
                <p className="text-sm text-muted">{selected.email}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">
                  {formatPrice(Number(selected.subtotal), selected.currency ?? "USD")}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-contrast p-3 text-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">商品明细</p>
              <ul className="mt-2 space-y-1">
                {selectedItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between">
                    <span>
                      {item.qty} x {item.titleSnapshot}
                    </span>
                    <span className="text-muted">
                      {formatPrice(Number(item.price), item.currency ?? "USD")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">付款链接</p>
              <Input
                placeholder="https://..."
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
              <Button
                className="w-full rounded-full"
                onClick={submitLink}
                disabled={!link.trim() || sending}
                loading={sending}
              >
                发送付款链接
              </Button>
              <p className="text-xs text-muted">
                支持 PayPal 发票链接或托管的 Stripe/Checkout 链接，系统会自动邮件通知客户。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
