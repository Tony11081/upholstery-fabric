"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useBagStore } from "@/lib/state/bag-store";
import { formatPrice } from "@/lib/utils/format";
import { useToast } from "@/lib/hooks/useToast";
import { trackEvent } from "@/lib/analytics/client";
import { resolveImageUrl } from "@/lib/utils/image";

type ShoppingItem = {
  id: string;
  slug: string;
  titleEn: string;
  price: number;
  currency: string;
  image?: string | null;
  category?: string | null;
};

type ShoppingListProps = {
  items: ShoppingItem[];
};

export function ShoppingList({ items }: ShoppingListProps) {
  const addItem = useBagStore((s) => s.addItem);
  const toast = useToast();

  const addAll = () => {
    items.forEach((item) => {
      addItem({
        productId: item.id,
        slug: item.slug,
        title: item.titleEn,
        price: item.price,
        currency: item.currency,
        quantity: 1,
        image: resolveImageUrl(item.image) ?? undefined,
      });
    });
    trackEvent("editorial_add_all", { count: items.length });
    toast.success("Added the full edit to your bag.");
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Shopping list</p>
          <h2 className="font-display text-2xl">Add the full edit</h2>
          <p className="text-sm text-muted">Curated pieces featured in this editorial.</p>
        </div>
        <Button className="rounded-full" onClick={addAll}>
          Add all to bag
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => {
          const imageUrl = resolveImageUrl(item.image);
          return (
          <div key={item.id} className="rounded-2xl border border-border bg-contrast p-3">
            <Link href={`/product/${item.slug}`} className="block">
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={item.titleEn}
                    fill
                    sizes="(min-width: 768px) 40vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                    Image coming soon
                  </div>
                )}
              </div>
            </Link>
            <div className="mt-3 space-y-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  {item.category ?? "Product"}
                </p>
                <p className="text-sm font-medium">{item.titleEn}</p>
                <p className="text-xs text-muted">{formatPrice(item.price, item.currency)}</p>
              </div>
                  <Button
                    size="sm"
                    className="w-full rounded-full"
                    onClick={() =>
                      addItem({
                        productId: item.id,
                        slug: item.slug,
                        title: item.titleEn,
                        price: item.price,
                        currency: item.currency,
                        quantity: 1,
                        image: resolveImageUrl(item.image) ?? undefined,
                      })
                    }
                  >
                    Add to bag
                  </Button>
                </div>
              </div>
          );
        })}
      </div>
    </section>
  );
}
