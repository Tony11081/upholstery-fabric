"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

type VipTier = {
  id: string;
  name: string;
  level: number;
  minSpend: string;
  pointsPerDollar: string;
  birthdayGift?: string | null;
  earlyAccessDays: number;
  supportChannel?: string | null;
};

type VipTierUpdate = {
  name?: string;
  level?: number;
  minSpend?: number;
  pointsPerDollar?: number;
  birthdayGift?: string | null;
  earlyAccessDays?: number;
  supportChannel?: string | null;
};

export function VipTiersClient() {
  const toast = useToast();
  const [tiers, setTiers] = useState<VipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("1");
  const [minSpend, setMinSpend] = useState("0");
  const [pointsPerDollar, setPointsPerDollar] = useState("1");
  const [birthdayGift, setBirthdayGift] = useState("");
  const [earlyAccessDays, setEarlyAccessDays] = useState("0");
  const [supportChannel, setSupportChannel] = useState("");

  const loadTiers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/vip-tiers");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load tiers");
      }
      setTiers(json.data?.tiers ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load tiers");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTiers();
  }, [loadTiers]);

  const createTier = async () => {
    try {
      const res = await fetch("/api/admin/vip-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          level: Number(level),
          minSpend: Number(minSpend),
          pointsPerDollar: Number(pointsPerDollar),
          birthdayGift: birthdayGift || undefined,
          earlyAccessDays: Number(earlyAccessDays || 0),
          supportChannel: supportChannel || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to create tier");
      }
      toast.success("VIP tier created");
      setName("");
      setLevel("1");
      setMinSpend("0");
      setPointsPerDollar("1");
      setBirthdayGift("");
      setEarlyAccessDays("0");
      setSupportChannel("");
      loadTiers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create tier");
    }
  };

  const updateTier = async (id: string, payload: VipTierUpdate) => {
    try {
      const res = await fetch(`/api/admin/vip-tiers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to update tier");
      }
      toast.success("VIP tier updated");
      loadTiers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update tier");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Insider" />
        <Input label="Level" value={level} onChange={(event) => setLevel(event.target.value)} />
        <Input label="Min spend" value={minSpend} onChange={(event) => setMinSpend(event.target.value)} />
        <Input
          label="Points / $"
          value={pointsPerDollar}
          onChange={(event) => setPointsPerDollar(event.target.value)}
        />
        <Input
          label="Birthday gift"
          value={birthdayGift}
          onChange={(event) => setBirthdayGift(event.target.value)}
          placeholder="Complimentary scarf"
        />
        <Input
          label="Early access (days)"
          value={earlyAccessDays}
          onChange={(event) => setEarlyAccessDays(event.target.value)}
        />
        <Input
          label="Support channel"
          value={supportChannel}
          onChange={(event) => setSupportChannel(event.target.value)}
          placeholder="Concierge chat"
        />
      </div>
      <Button onClick={createTier}>Create tier</Button>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading tiers...</p>
        ) : tiers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tiers configured.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">Name</th>
                <th className="py-2 pr-2">Level</th>
                <th className="py-2 pr-2">Min Spend</th>
                <th className="py-2 pr-2">Points/$</th>
                <th className="py-2 pr-2">Birthday Gift</th>
                <th className="py-2 pr-2">Early Access</th>
                <th className="py-2 pr-2">Support</th>
                <th className="py-2 pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => (
                <VipTierRow key={tier.id} tier={tier} onSave={updateTier} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function VipTierRow({ tier, onSave }: { tier: VipTier; onSave: (id: string, payload: VipTierUpdate) => void }) {
  const [name, setName] = useState(tier.name);
  const [level, setLevel] = useState(String(tier.level));
  const [minSpend, setMinSpend] = useState(String(tier.minSpend));
  const [pointsPerDollar, setPointsPerDollar] = useState(String(tier.pointsPerDollar));
  const [birthdayGift, setBirthdayGift] = useState(tier.birthdayGift ?? "");
  const [earlyAccessDays, setEarlyAccessDays] = useState(String(tier.earlyAccessDays ?? 0));
  const [supportChannel, setSupportChannel] = useState(tier.supportChannel ?? "");

  return (
    <tr className="border-b border-border/40 last:border-b-0">
      <td className="py-3 pr-2">
        <input
          className="w-32 rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </td>
      <td className="py-3 pr-2">
        <input
          className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={level}
          onChange={(event) => setLevel(event.target.value)}
        />
      </td>
      <td className="py-3 pr-2">
        <input
          className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={minSpend}
          onChange={(event) => setMinSpend(event.target.value)}
        />
      </td>
      <td className="py-3 pr-2">
        <input
          className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={pointsPerDollar}
          onChange={(event) => setPointsPerDollar(event.target.value)}
        />
      </td>
      <td className="py-3 pr-2">
        <input
          className="w-32 rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={birthdayGift}
          onChange={(event) => setBirthdayGift(event.target.value)}
        />
      </td>
      <td className="py-3 pr-2">
        <input
          className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={earlyAccessDays}
          onChange={(event) => setEarlyAccessDays(event.target.value)}
        />
      </td>
      <td className="py-3 pr-2">
        <input
          className="w-32 rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={supportChannel}
          onChange={(event) => setSupportChannel(event.target.value)}
        />
      </td>
      <td className="py-3 pr-2">
        <Button
          size="sm"
          onClick={() =>
            onSave(tier.id, {
              name,
              level: Number(level),
              minSpend: Number(minSpend),
              pointsPerDollar: Number(pointsPerDollar),
              birthdayGift,
              earlyAccessDays: Number(earlyAccessDays || 0),
              supportChannel,
            })
          }
        >
          Save
        </Button>
      </td>
    </tr>
  );
}
