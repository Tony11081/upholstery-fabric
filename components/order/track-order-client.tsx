"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Package, Search, Truck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/lib/hooks/useToast";
import { resolveImageUrl } from "@/lib/utils/image";

type ShipmentHistoryEntry = {
  timestamp?: string;
  status?: string;
  message?: string;
};

type TrackedOrder = {
  orderNumber: string;
  email: string;
  createdAt?: string | Date | null;
  status?: string;
  items: Array<{
    id: string;
    qty: number;
    price: number | string;
    currency: string;
    titleSnapshot?: string | null;
    product?: {
      titleEn: string;
      images: Array<{ url: string; alt?: string | null }>;
    };
  }>;
  shipments?: Array<{
    id: string;
    carrier?: string | null;
    trackingNumber?: string | null;
    status?: string | null;
    statusHistory?: unknown;
  }>;
};

type Props = {
  initialOrderNumber?: string;
  initialEmail?: string;
};

export function TrackOrderClient({ initialOrderNumber = "", initialEmail = "" }: Props) {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setOrder(null);

    try {
      const response = await fetch("/api/order/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email }),
      });
      const data = (await response.json().catch(() => null)) as
        | { order?: TrackedOrder; error?: string; message?: string; requestId?: string }
        | null;
      if (!response.ok || !data?.order) {
        const message = data?.message ?? data?.error ?? "Order not found";
        const requestId = data?.requestId ? ` (ref: ${data.requestId})` : "";
        const finalMessage = `${message}${requestId}`;
        setError(finalMessage);
        toast({
          title: "Unable to find order",
          description: finalMessage,
          variant: "error",
        });
        return;
      }
      setOrder(data.order as TrackedOrder);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to look up this order right now.";
      setError(message);
      toast({
        title: "Lookup failed",
        description: message,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const shipment = order?.shipments?.[0];
  const history = Array.isArray(shipment?.statusHistory)
    ? (shipment?.statusHistory as ShipmentHistoryEntry[])
    : [];
  const sortedHistory = [...history].sort(
    (a, b) =>
      new Date(b.timestamp ?? "").getTime() -
      new Date(a.timestamp ?? "").getTime(),
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Track</p>
        <h1 className="font-display text-3xl leading-tight">Track your order securely</h1>
        <p className="text-sm text-muted">
          Enter your order number and the email used at checkout. Guest orders are supported.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-[0.18em] text-muted" htmlFor="order-number">
              Order number
            </label>
            <Input
              id="order-number"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="UOOTD-24001"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-[0.18em] text-muted" htmlFor="order-email">
              Email
            </label>
            <Input
              id="order-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" className="rounded-full" loading={loading} disabled={!orderNumber || !email}>
            <Search className="mr-2 h-4 w-4" /> Track order
          </Button>
          <p className="text-xs text-muted">Secure lookup | Email must match your confirmation</p>
        </div>
      </form>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-contrast px-4 py-3 text-sm text-muted">
          <XCircle className="h-4 w-4 text-ink" />
          <span>{error}</span>
        </div>
      )}

      {order && (
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Order</p>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{order.orderNumber}</h2>
                <Badge tone="outline" muted>
                  {order.email}
                </Badge>
              </div>
              <p className="text-sm text-muted">
                Placed {order.createdAt ? format(new Date(order.createdAt), "PPP") : "-"}
              </p>
            </div>
            {shipment?.trackingNumber && (
              <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted">
                <Truck size={14} />
                <span>{shipment.trackingNumber}</span>
              </div>
            )}
          </div>

          <div className="divide-y divide-border rounded-xl border border-border">
            {order.items.map((item) => {
              const cover = item.product?.images?.[0];
              const coverUrl = resolveImageUrl(cover?.url);
              return (
                <div key={item.id} className="flex items-center gap-4 p-4">
                  {coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverUrl}
                      alt={cover?.alt ?? item.titleSnapshot ?? item.product?.titleEn ?? "Product"}
                      className="h-14 w-12 rounded-md border border-border object-cover"
                    />
                  )}
                  <div className="flex flex-1 flex-col">
                    <span className="font-medium">{item.titleSnapshot ?? item.product?.titleEn ?? "Product"}</span>
                    <span className="text-xs text-muted">Qty {item.qty}</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatPrice(Number(item.price) || 0, item.currency)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-contrast p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-ink" />
              <p className="text-sm font-semibold">Shipping timeline</p>
            </div>
            <div className="space-y-2">
              {sortedHistory.length === 0 && (
                <p className="text-sm text-muted">Updates appear here once the carrier scans your parcel.</p>
              )}
              {sortedHistory.map((entry, idx) => (
                <div key={`${entry.timestamp}-${idx}`} className="flex items-start gap-3 rounded-lg bg-white/30 px-3 py-2">
                  <div className={cn("mt-1 h-2 w-2 rounded-full", "bg-ink")} aria-hidden />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{entry.status ?? "Update"}</p>
                    <p className="text-sm text-muted">{entry.message}</p>
                    <p className="text-xs text-muted">
                      {entry.timestamp ? format(new Date(entry.timestamp), "PPpp") : "Timestamp unavailable"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
