"use client";

import Image from "next/image";
import Link from "next/link";
import { ReviewForm } from "@/components/product/review-form";
import { resolveImageUrl } from "@/lib/utils/image";

export type ReviewEligibleItem = {
  productId: string;
  slug: string;
  title: string;
  image: string | null;
  orderNumber: string;
  deliveredAt?: string | null;
};

type Props = {
  items: ReviewEligibleItem[];
  defaultEmail?: string;
};

export function ReviewEligibleList({ items, defaultEmail }: Props) {
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const imageUrl = resolveImageUrl(item.image);
        return (
          <div
            key={`${item.orderNumber}-${item.productId}`}
            className="rounded-xl border border-border bg-contrast p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="relative h-20 w-16 overflow-hidden rounded-lg border border-border bg-white">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={item.title}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                      Image coming soon
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted">Order {item.orderNumber}</p>
                  {item.deliveredAt ? (
                    <p className="text-xs text-muted">Delivered {item.deliveredAt}</p>
                  ) : null}
                </div>
              </div>
              <Link href={`/product/${item.slug}`} className="text-sm underline underline-offset-4">
                View item
              </Link>
            </div>
            <div className="mt-4">
              <ReviewForm
                productId={item.productId}
                defaultEmail={defaultEmail}
                hideEmail
                className="border-0 bg-transparent p-0 shadow-none"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
