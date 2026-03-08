"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

export function DropReservationForm({ contentId }: { contentId: string }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/drops/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, email, name }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to reserve");
      }
      setSubmitted(true);
      toast.success("Reservation confirmed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reserve");
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <h3 className="font-display text-lg">Reserve this drop</h3>
      <p className="mt-2 text-sm text-muted">Reserve early access and receive a secure checkout link when ready.</p>
      <div className="mt-4 grid gap-3">
        <Input label="Name (optional)" value={name} onChange={(event) => setName(event.target.value)} />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Button onClick={handleSubmit} loading={loading} disabled={submitted}>
          {submitted ? "Reserved" : "Reserve"}
        </Button>
      </div>
    </div>
  );
}
