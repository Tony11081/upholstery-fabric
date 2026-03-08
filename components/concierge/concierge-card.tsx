"use client";

import { useMemo, useState } from "react";
import { Copy, PhoneCall, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/useToast";
import { ConsultationForm } from "@/components/concierge/consultation-form";

type ConciergeCardProps = {
  context?: Record<string, unknown>;
  compact?: boolean;
};

export function ConciergeCard({ context, compact }: ConciergeCardProps) {
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const whatsapp = process.env.NEXT_PUBLIC_CONCIERGE_WHATSAPP ?? "";
  const wechat = process.env.NEXT_PUBLIC_CONCIERGE_WECHAT ?? "";
  const phone = process.env.NEXT_PUBLIC_CONCIERGE_PHONE ?? "";
  const email = process.env.NEXT_PUBLIC_CONCIERGE_EMAIL ?? process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "";

  const whatsappLink = useMemo(() => {
    if (!whatsapp) return "";
    const digits = whatsapp.replace(/[^\d+]/g, "");
    return `https://wa.me/${digits.replace(/^\+/, "")}`;
  }, [whatsapp]);

  const copyWeChat = async () => {
    if (!wechat) return;
    try {
      await navigator.clipboard.writeText(wechat);
      toast.success("WeChat ID copied.");
    } catch {
      toast.error("Unable to copy WeChat ID.");
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Concierge</p>
        <h3 className="font-display text-xl">Your personal concierge</h3>
        <p className="text-sm text-muted">
          Direct help with sizing, quality checks, and delivery details.
        </p>
      </div>

      <div className={`grid gap-3 ${compact ? "grid-cols-1" : "sm:grid-cols-3"}`}>
        {whatsappLink && (
          <Button asChild variant="ghost" className="justify-start gap-2 rounded-full border border-border">
            <a href={whatsappLink} target="_blank" rel="noreferrer">
              <MessageCircle size={16} />
              WhatsApp
            </a>
          </Button>
        )}
        {wechat && (
          <Button
            type="button"
            variant="ghost"
            className="justify-start gap-2 rounded-full border border-border"
            onClick={copyWeChat}
          >
            <Copy size={16} />
            WeChat
          </Button>
        )}
        {phone && (
          <Button asChild variant="ghost" className="justify-start gap-2 rounded-full border border-border">
            <a href={`tel:${phone}`}>
              <PhoneCall size={16} />
              Call concierge
            </a>
          </Button>
        )}
        {!compact && email && (
          <Button asChild variant="ghost" className="justify-start gap-2 rounded-full border border-border">
            <a href={`mailto:${email}`}>
              <Mail size={16} />
              Email
            </a>
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <Button
          variant="ghost"
          className="w-full rounded-full"
          onClick={() => setShowForm((prev) => !prev)}
        >
          {showForm ? "Hide consultation form" : "Request a private consultation"}
        </Button>
        {showForm && <ConsultationForm context={context} />}
      </div>
    </div>
  );
}
