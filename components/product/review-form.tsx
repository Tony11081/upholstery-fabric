"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";
import { cn } from "@/lib/utils/cn";

type ReviewFormProps = {
  productId: string;
  defaultEmail?: string;
  hideEmail?: boolean;
  className?: string;
};

export function ReviewForm({ productId, defaultEmail, hideEmail, className }: ReviewFormProps) {
  const toast = useToast();
  const [rating, setRating] = useState("5");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (defaultEmail) {
      setEmail(defaultEmail);
    }
  }, [defaultEmail]);

  const submit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const resolvedEmail = (defaultEmail ?? email).trim();
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          rating: Number(rating),
          title: title.trim() || undefined,
          body: body.trim() || undefined,
          email: resolvedEmail || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to submit review");
      }
      setTitle("");
      setBody("");
      toast.success("Review submitted for verification");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit review");
    } finally {
      setLoading(false);
    }
  };

  const showEmail = !hideEmail;

  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <h3 className="font-display text-lg">Share your review</h3>
      <p className="text-xs text-muted">
        Reviews are verified before publishing. Approved reviews receive a thank-you credit.
      </p>
      <div className={`grid gap-3 ${showEmail ? "md:grid-cols-2" : ""}`}>
        <label className="flex flex-col gap-2 text-sm text-ink">
          <span className="font-medium">Rating</span>
          <select
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
            value={rating}
            onChange={(event) => setRating(event.target.value)}
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} stars
              </option>
            ))}
          </select>
        </label>
        {showEmail && (
          <Input
            label="Email (optional)"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
      </div>
      <Input
        label="Title (optional)"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="A quick headline"
      />
      <label className="flex flex-col gap-2 text-sm text-ink">
        <span className="font-medium">Your experience</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Share your experience with fit, quality, and delivery."
          className="min-h-[110px] rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
        />
      </label>
      <Button onClick={submit} loading={loading} className="w-full rounded-full">
        Submit review
      </Button>
    </div>
  );
}
