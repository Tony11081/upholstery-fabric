"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/useToast";

export function ReferralCard() {
  const toast = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    const load = async () => {
      try {
        const res = await fetch("/api/referrals/code");
        const json = await res.json();
        if (res.ok && json.data?.code?.code) {
          setCode(json.data.code.code);
        }
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/referrals/code", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to generate code");
      }
      setCode(json.data?.code?.code ?? null);
      toast.success("Referral code ready");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate code");
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = code ? `${origin}/?ref=${code}` : "";

  const copyShare = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied");
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <h3 className="font-display text-lg">Invite & earn</h3>
      <p className="mt-2 text-sm text-muted">
        Share your invite link. Friends get a welcome credit and you earn when they purchase.
      </p>
      {code ? (
        <div className="mt-4 space-y-2">
          <div className="rounded-lg border border-border bg-contrast px-3 py-2 text-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Your link</p>
            <p className="break-all text-ink">{shareUrl}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={copyShare}>
            Copy link
          </Button>
        </div>
      ) : (
        <div className="mt-4">
          <Button size="sm" onClick={generate} loading={loading}>
            Generate invite link
          </Button>
        </div>
      )}
    </section>
  );
}
