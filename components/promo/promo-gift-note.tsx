import { Gift } from "lucide-react";
import { PROMO_GIFT } from "@/lib/utils/promo";

type PromoGiftNoteProps = {
  className?: string;
};

export function PromoGiftNote({ className }: PromoGiftNoteProps) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-dashed border-border bg-contrast px-3 py-2 text-xs text-muted ${className ?? ""}`}
    >
      <Gift className="mt-0.5 h-4 w-4 text-ink" />
      <div className="space-y-0.5">
        <p className="font-medium text-ink">{PROMO_GIFT.title}</p>
        <p>{PROMO_GIFT.description}</p>
      </div>
    </div>
  );
}
