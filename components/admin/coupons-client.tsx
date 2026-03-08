"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

type Coupon = {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  amount: string;
  active: boolean;
  assignments: Array<{ id: string }>;
};

export function CouponsClient() {
  const toast = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE");
  const [amount, setAmount] = useState("10");
  const [emails, setEmails] = useState("");
  const [segment, setSegment] = useState("");
  const [tag, setTag] = useState("");

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coupons");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load coupons");
      }
      setCoupons(json.data?.coupons ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load coupons");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const createCoupon = async () => {
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount: Number(amount) }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to create coupon");
      }
      toast.success("Coupon created");
      loadCoupons();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create coupon");
    }
  };

  const sendCoupon = async (couponId: string) => {
    const emailList = emails
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    try {
      const res = await fetch("/api/admin/coupons/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couponId,
          emails: emailList.length ? emailList : undefined,
          segment: segment || undefined,
          tag: tag || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to send coupon");
      }
      toast.success(`Sent ${json.data?.sent ?? 0} coupons`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send coupon");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm text-ink">
          <span className="font-medium text-ink">Type</span>
          <select
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
            value={type}
            onChange={(event) => setType(event.target.value as "PERCENTAGE" | "FIXED_AMOUNT")}
          >
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED_AMOUNT">Fixed amount</option>
          </select>
        </label>
        <Input label="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </div>
      <Button onClick={createCoupon}>Create coupon</Button>

      <div className="grid gap-3 md:grid-cols-3">
        <Input
          label="Emails (comma separated)"
          value={emails}
          onChange={(event) => setEmails(event.target.value)}
          placeholder="vip@brand.com, client@brand.com"
        />
        <Input
          label="Segment (optional)"
          value={segment}
          onChange={(event) => setSegment(event.target.value)}
          placeholder="VIP"
        />
        <Input
          label="Tag (optional)"
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          placeholder="editorial"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading coupons...</p>
        ) : coupons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No coupons available.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">Code</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Amount</th>
                <th className="py-2 pr-2">Assigned</th>
                <th className="py-2 pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-border/40 last:border-b-0">
                  <td className="py-3 pr-2 font-medium">{coupon.code}</td>
                  <td className="py-3 pr-2">{coupon.type}</td>
                  <td className="py-3 pr-2">{Number(coupon.amount).toFixed(2)}</td>
                  <td className="py-3 pr-2">{coupon.assignments.length}</td>
                  <td className="py-3 pr-2">
                    <Button size="sm" onClick={() => sendCoupon(coupon.id)}>
                      Send
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

