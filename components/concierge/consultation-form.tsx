"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";
import { trackEvent } from "@/lib/analytics/client";

type ConsultationFormProps = {
  context?: Record<string, unknown>;
  defaultChannel?: string;
  onSuccess?: () => void;
};

export function ConsultationForm({
  context,
  defaultChannel = "WHATSAPP",
  onSuccess,
}: ConsultationFormProps) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState(defaultChannel);
  const [preferredAt, setPreferredAt] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim()) {
      toast.error("Email is required so we can reach you.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/concierge/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || undefined,
          channel,
          preferredAt: preferredAt || undefined,
          notes: notes.trim() || undefined,
          context,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Unable to submit request");
      }
      trackEvent("concierge_request_submitted", { channel, context });
      toast.success("Request received. A concierge will reach out within one business day.");
      setName("");
      setEmail("");
      setPhone("");
      setPreferredAt("");
      setNotes("");
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-contrast p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">Consultation</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label className="flex flex-col gap-2 text-sm text-ink">
          <span className="font-medium text-ink">Preferred channel</span>
          <select
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="WHATSAPP">WhatsApp</option>
            <option value="WECHAT">WeChat</option>
            <option value="PHONE">Phone</option>
            <option value="EMAIL">Email</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          label="Preferred time (optional)"
          type="datetime-local"
          value={preferredAt}
          onChange={(e) => setPreferredAt(e.target.value)}
        />
        <div className="flex flex-col gap-2 text-sm text-ink">
          <span className="font-medium text-ink">Notes</span>
          <textarea
            className="min-h-[48px] rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Style preferences, sizing, delivery timing..."
          />
        </div>
      </div>
      <Button className="w-full rounded-full" onClick={submit} loading={loading} disabled={!email.trim()}>
        Request consultation
      </Button>
      <p className="text-xs text-muted">
        We respond within one business day. Your details are kept private and used only for this request.
      </p>
    </div>
  );
}
