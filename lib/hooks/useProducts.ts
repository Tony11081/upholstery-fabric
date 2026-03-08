"use client";

import { useQuery } from "@tanstack/react-query";
import type { ProductListItem } from "@/lib/data/products";

async function fetchProducts(queryString: string) {
  const res = await fetch(`/api/products${queryString}`);
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as
      | { message?: string; error?: string; requestId?: string }
      | null;
    const message = data?.message ?? data?.error ?? "Unable to load products";
    const requestId = data?.requestId ? ` (ref: ${data.requestId})` : "";
    throw new Error(`${message}${requestId}`);
  }
  const json = (await res.json().catch(() => null)) as { products?: ProductListItem[] } | null;
  return json?.products ?? [];
}

export function useProducts(params?: {
  q?: string;
  category?: string;
  categoryGroup?: string;
  brand?: string;
  color?: string;
  size?: string;
  material?: string;
  tag?: string;
  sort?: string;
  isNew?: boolean;
  minPrice?: number | null;
  maxPrice?: number | null;
  availability?: "in_stock" | null;
  limit?: number;
}, options?: {
  initialData?: ProductListItem[];
  staleTime?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set("q", params.q);
  if (params?.category) searchParams.set("category", params.category);
  if (params?.categoryGroup) searchParams.set("categoryGroup", params.categoryGroup);
  if (params?.brand) searchParams.set("brand", params.brand);
  if (params?.color) searchParams.set("color", params.color);
  if (params?.size) searchParams.set("size", params.size);
  if (params?.material) searchParams.set("material", params.material);
  if (params?.tag) searchParams.set("tag", params.tag);
  if (params?.sort) searchParams.set("sort", params.sort);
  if (params?.isNew) searchParams.set("isNew", String(params.isNew));
  if (params?.minPrice) searchParams.set("minPrice", String(params.minPrice));
  if (params?.maxPrice) searchParams.set("maxPrice", String(params.maxPrice));
  if (params?.availability) searchParams.set("availability", params.availability);
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";

  return useQuery({
    queryKey: ["products", params],
    queryFn: () => fetchProducts(queryString),
    initialData: options?.initialData,
    staleTime: options?.staleTime ?? 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
