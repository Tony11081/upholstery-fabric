"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/useToast";

const TYPE_OPTIONS = ["", "BACK_IN_STOCK", "PRICE_DROP", "NEW_ARRIVAL"] as const;

type Subscription = {
  id: string;
  type: string;
  email: string;
  active: boolean;
  createdAt: string;
  product?: { id: string; titleEn: string; slug: string } | null;
  category?: { id: string; nameEn: string; slug: string } | null;
};

export function SubscriptionsClient() {
  const toast = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]>("");

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      const res = await fetch(`/api/admin/subscriptions?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load subscriptions");
      }
      setSubscriptions(json.data?.subscriptions ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load subscriptions");
    } finally {
      setLoading(false);
    }
  }, [type, toast]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const toggleActive = async (id: string, nextActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to update subscription");
      }
      toast.success("Subscription updated");
      loadSubscriptions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update subscription");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-sm text-ink">
          <span className="font-medium text-ink">Type</span>
          <select
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
            value={type}
            onChange={(event) => setType(event.target.value as (typeof TYPE_OPTIONS)[number])}
          >
            <option value="">All</option>
            <option value="BACK_IN_STOCK">Back in stock</option>
            <option value="PRICE_DROP">Price drop</option>
            <option value="NEW_ARRIVAL">New arrival</option>
          </select>
        </label>
        <Button variant="ghost" onClick={loadSubscriptions}>
          Refresh
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading subscriptions...</p>
        ) : subscriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subscriptions found.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">Email</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Target</th>
                <th className="py-2 pr-2">Active</th>
                <th className="py-2 pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((subscription) => (
                <tr key={subscription.id} className="border-b border-border/40 last:border-b-0">
                  <td className="py-3 pr-2">
                    <div className="flex flex-col">
                      <span className="font-medium">{subscription.email}</span>
                      <span className="text-xs text-muted">
                        {new Date(subscription.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pr-2">{subscription.type}</td>
                  <td className="py-3 pr-2">
                    {subscription.product
                      ? subscription.product.titleEn
                      : subscription.category
                      ? subscription.category.nameEn
                      : "Global"}
                  </td>
                  <td className="py-3 pr-2">{subscription.active ? "Yes" : "No"}</td>
                  <td className="py-3 pr-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleActive(subscription.id, !subscription.active)}
                    >
                      {subscription.active ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
