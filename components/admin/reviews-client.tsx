"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

type Review = {
  id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  status: string;
  createdAt: string;
  rewardedAt?: string | null;
  rewardCouponCode?: string | null;
  product: { titleEn: string };
  customer?: { email?: string | null } | null;
};

export function ReviewsClient() {
  const toast = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [rewardCode, setRewardCode] = useState("");

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/reviews?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load reviews");
      }
      let items = (json.data?.reviews ?? []) as Review[];
      if (query) {
        const lower = query.toLowerCase();
        items = items.filter(
          (review) =>
            review.product.titleEn.toLowerCase().includes(lower) ||
            (review.title ?? "").toLowerCase().includes(lower) ||
            (review.body ?? "").toLowerCase().includes(lower),
        );
      }
      setReviews(items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load reviews");
    } finally {
      setLoading(false);
    }
  }, [query, status, toast]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const updateStatus = async (
    id: string,
    nextStatus: "APPROVED" | "REJECTED" | "PENDING",
    withReward = false,
  ) => {
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          rewardCouponCode: withReward ? rewardCode : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Update failed");
      }
      toast.success("Review updated");
      if (json.data?.rewardError) {
        toast.error(json.data.rewardError);
      }
      setReviews((prev) =>
        prev.map((review) =>
          review.id === id
            ? {
                ...review,
                status: nextStatus,
                rewardedAt: json.data?.review?.rewardedAt ?? review.rewardedAt,
                rewardCouponCode: json.data?.review?.rewardCouponCode ?? review.rewardCouponCode,
              }
            : review,
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by product or review"
        />
        <Input
          label="Reward coupon code (optional)"
          value={rewardCode}
          onChange={(event) => setRewardCode(event.target.value)}
          placeholder="UOOTD-XYZ"
        />
        <label className="flex flex-col gap-2 text-sm text-ink">
          <span className="font-medium text-ink">Status</span>
          <select
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </label>
        <Button variant="ghost" onClick={loadReviews}>
          Refresh
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews found.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">Product</th>
                <th className="py-2 pr-2">Rating</th>
                <th className="py-2 pr-2">Title</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Customer</th>
                <th className="py-2 pr-2">Reward</th>
                <th className="py-2 pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id} className="border-b border-border/40 last:border-b-0">
                  <td className="py-3 pr-2 font-medium">{review.product.titleEn}</td>
                  <td className="py-3 pr-2">{review.rating}</td>
                  <td className="py-3 pr-2">{review.title ?? review.body?.slice(0, 40) ?? "-"}</td>
                  <td className="py-3 pr-2">{review.status}</td>
                  <td className="py-3 pr-2">{review.customer?.email ?? "-"}</td>
                  <td className="py-3 pr-2 text-xs text-muted-foreground">
                    {review.rewardedAt ? `Sent (${review.rewardCouponCode ?? "Coupon"})` : "-"}
                  </td>
                  <td className="py-3 pr-2">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => updateStatus(review.id, "APPROVED")}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!rewardCode.trim()}
                        onClick={() => updateStatus(review.id, "APPROVED", true)}
                      >
                        Approve + reward
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(review.id, "REJECTED")}>
                        Reject
                      </Button>
                    </div>
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
