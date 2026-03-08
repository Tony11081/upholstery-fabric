import { Gift } from "lucide-react";
import { PROMO_GIFT } from "@/lib/utils/promo";
import { CurrencySwitcher } from "@/components/display/currency-switcher";
import { LanguageSwitcher } from "@/components/display/language-switcher";

export function PromoBar() {
  return (
    <div className="border-b border-border bg-contrast">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-xs text-muted md:text-sm">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-ink" />
          <span className="font-medium text-ink">{PROMO_GIFT.title}</span>
          <span className="hidden text-muted md:inline">{PROMO_GIFT.description}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[0.7rem] uppercase tracking-[0.2em] text-muted">Limited gift</span>
          <LanguageSwitcher />
          <CurrencySwitcher />
        </div>
      </div>
    </div>
  );
}
