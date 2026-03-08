"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

type ReferralCode = {
  id: string;
  code: string;
  active: boolean;
  rewardType: "CREDIT" | "PERCENTAGE" | "FIXED_AMOUNT";
  rewardValue: string;
  customer: { email: string };
  referrals: Array<{ id: string; status: string }>;
  createdAt: string;
};

export function ReferralsClient() {
  const toast = useToast();
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [rewardType, setRewardType] = useState<ReferralCode["rewardType"]>("CREDIT");
  const [rewardValue, setRewardValue] = useState("0");

  const loadCodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/referrals");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load referral codes");
      }
      setCodes(json.data?.codes ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load referral codes");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  const createCode = async () => {
    if (!email.trim()) {
      toast.error("Enter an email");
      return;
    }
    try {
      const res = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, rewardType, rewardValue: Number(rewardValue) }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to create referral code");
      }
      toast.success("Referral code created");
      setEmail("");
      setRewardValue("0");
      loadCodes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create referral code");
    }
  };

  const updateCode = async (id: string, payload: { active: boolean; rewardType: ReferralCode["rewardType"]; rewardValue: number }) => {
    try {
      const res = await fetch(`/api/admin/referrals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to update referral");
      }
      toast.success("Referral updated");
      loadCodes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update referral");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Customer email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="client@example.com"
        />
        <label className="flex flex-col gap-2 text-sm text-ink">
          <span className="font-medium text-ink">Reward type</span>
          <select
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
            value={rewardType}
            onChange={(event) => setRewardType(event.target.value as ReferralCode["rewardType"])}
          >
            <option value="CREDIT">Credit</option>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED_AMOUNT">Fixed amount</option>
          </select>
        </label>
        <Input
          label="Reward value"
          value={rewardValue}
          onChange={(event) => setRewardValue(event.target.value)}
          placeholder="25"
        />
        <Button onClick={createCode}>Generate code</Button>
        <Button variant="ghost" onClick={loadCodes}>
          Refresh
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading referral codes...</p>
        ) : codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No referral codes yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">Code</th>
                <th className="py-2 pr-2">Customer</th>
                <th className="py-2 pr-2">Reward</th>
                <th className="py-2 pr-2">Referrals</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => (
                <ReferralRow key={code.id} code={code} onSave={updateCode} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ReferralRow({
  code,
  onSave,
}: {
  code: ReferralCode;
  onSave: (id: string, payload: { active: boolean; rewardType: ReferralCode["rewardType"]; rewardValue: number }) => void;
}) {
  const [active, setActive] = useState(code.active);
  const [rewardType, setRewardType] = useState<ReferralCode["rewardType"]>(code.rewardType);
  const [rewardValue, setRewardValue] = useState(String(code.rewardValue));

  return (
    <tr className="border-b border-border/40 last:border-b-0">
      <td className="py-3 pr-2 font-medium">{code.code}</td>
      <td className="py-3 pr-2">{code.customer.email}</td>
      <td className="py-3 pr-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            value={rewardType}
            onChange={(event) => setRewardType(event.target.value as ReferralCode["rewardType"])}
          >
            <option value="CREDIT">Credit</option>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED_AMOUNT">Fixed</option>
          </select>
          <input
            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-xs"
            value={rewardValue}
            onChange={(event) => setRewardValue(event.target.value)}
          />
        </div>
      </td>
      <td className="py-3 pr-2">{code.referrals.length}</td>
      <td className="py-3 pr-2">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          Active
        </label>
      </td>
      <td className="py-3 pr-2">
        <Button size="sm" onClick={() => onSave(code.id, { active, rewardType, rewardValue: Number(rewardValue) })}>
          Save
        </Button>
      </td>
    </tr>
  );
}
