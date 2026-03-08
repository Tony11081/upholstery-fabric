"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/useToast";
import { useBagStore } from "@/lib/state/bag-store";
import { trackEvent } from "@/lib/analytics/client";
import { resolveImageUrl } from "@/lib/utils/image";

type ReorderItem = {
  productId: string;
  slug: string;
  title: string;
  price: number;
  currency: string;
  image?: string | null;
  quantity?: number;
};

type ReorderActionsProps = {
  items: ReorderItem[];
  label?: string;
};

export function ReorderActions({ items, label = "Reorder all" }: ReorderActionsProps) {
  const addItem = useBagStore((s) => s.addItem);
  const toast = useToast();

  const handleReorder = () => {
    items.forEach((item) => {
      addItem({
        productId: item.productId,
        slug: item.slug,
        title: item.title,
        price: item.price,
        currency: item.currency,
        quantity: item.quantity ?? 1,
        image: resolveImageUrl(item.image) ?? undefined,
      });
    });
    trackEvent("reorder_added", { count: items.length });
    toast.success("Items added to bag. Ready when you are.");
  };

  if (!items.length) return null;

  return (
    <Button variant="ghost" className="rounded-full" onClick={handleReorder}>
      {label}
    </Button>
  );
}
