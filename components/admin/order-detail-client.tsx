"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

type OrderItem = {
  id: string;
  qty: number;
  price: string;
  currency: string;
  titleSnapshot?: string | null;
  product?: {
    slug?: string | null;
    titleEn?: string | null;
  } | null;
};

type Shipment = {
  id: string;
  trackingNumber?: string | null;
  carrier?: string | null;
  statusHistory?: Array<{ timestamp: string; status: string; message: string }>;
};

type Order = {
  id: string;
  orderNumber: string;
  email: string;
  status: string;
  total: string;
  currency: string;
  createdAt: string;
  shippingAddress?: Record<string, string>;
  billingAddress?: Record<string, string>;
  items: OrderItem[];
  shipments: Shipment[];
  paymentLinkUrl?: string | null;
  paypalInvoiceUrl?: string | null;
};

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load order");
      }
      const data = json.data?.order ?? json.order;
      setOrder(data);
      setStatus(data.status);
      const shipment = data.shipments?.[0];
      setTrackingNumber(shipment?.trackingNumber ?? "");
      setCarrier(shipment?.carrier ?? "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load order");
    } finally {
      setLoading(false);
    }
  }, [orderId, toast]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          trackingNumber: trackingNumber || undefined,
          carrier: carrier || undefined,
          note: note || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to update order");
      }
      toast.success("Order updated");
      setNote("");
      setOrder(json.data?.order ?? json.order ?? order);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update order");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading order...</p>;
  }

  if (!order) {
    return <p className="text-sm text-muted-foreground">Order not found.</p>;
  }

  const shipment = order.shipments?.[0];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Order</p>
            <h1 className="font-display text-3xl">{order.orderNumber}</h1>
            <p className="text-sm text-muted-foreground">{order.email}</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Status: {order.status}</p>
            <p>
              Total: {order.currency} {order.total}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-base font-medium">Items</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {order.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col">
                  <span>
                    {item.qty} x {item.titleSnapshot ?? item.product?.titleEn ?? "Item"}
                  </span>
                  {item.product?.slug ? (
                    <a
                      className="text-xs text-ink underline underline-offset-4"
                      href={`/product/${item.product.slug}`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      View product link
                    </a>
                  ) : null}
                </div>
                <span>
                  {item.currency} {item.price}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-base font-medium">Update status</h2>
          <label className="flex flex-col gap-2 text-sm text-ink">
            <span className="font-medium text-ink">Order status</span>
            <select
              className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="PENDING">Pending</option>
              <option value="AWAITING_PAYMENT_LINK">Awaiting link</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PROCESSING">Processing</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELED">Canceled</option>
              <option value="RETURNED">Returned</option>
            </select>
          </label>
          <Input
            label="Tracking number"
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
          />
          <Input label="Carrier" value={carrier} onChange={(event) => setCarrier(event.target.value)} />
          <label className="flex flex-col gap-2 text-sm text-ink">
            <span className="font-medium text-ink">Timeline note</span>
            <textarea
              className="min-h-[80px] rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add a timeline note for customers"
            />
          </label>
          <Button onClick={handleUpdate} loading={saving}>
            Save updates
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground">
          <h3 className="text-base font-medium text-ink">Shipping address</h3>
          <pre className="mt-3 whitespace-pre-wrap text-xs">
            {JSON.stringify(order.shippingAddress ?? {}, null, 2)}
          </pre>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground">
          <h3 className="text-base font-medium text-ink">Timeline</h3>
          {shipment?.statusHistory?.length ? (
            <ul className="mt-3 space-y-2 text-xs">
              {shipment.statusHistory.map((entry, idx) => (
                <li key={`${entry.timestamp}-${idx}`}>
                  <strong>{entry.status}</strong> - {entry.message} ({new Date(entry.timestamp).toLocaleString()})
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">No timeline updates yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
