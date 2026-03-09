"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import type { ProductListItem } from "@/lib/data/products";

type ProductQueryParams = {
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
};

type UseInfiniteProductsOptions = {
  initialData?: ProductListItem[];
  staleTime?: number;
};

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

function buildQueryString(params: ProductQueryParams, page: number, limit: number) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.category) searchParams.set("category", params.category);
  if (params.categoryGroup) searchParams.set("categoryGroup", params.categoryGroup);
  if (params.brand) searchParams.set("brand", params.brand);
  if (params.color) searchParams.set("color", params.color);
  if (params.size) searchParams.set("size", params.size);
  if (params.material) searchParams.set("material", params.material);
  if (params.tag) searchParams.set("tag", params.tag);
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.isNew) searchParams.set("isNew", String(params.isNew));
  if (params.minPrice) searchParams.set("minPrice", String(params.minPrice));
  if (params.maxPrice) searchParams.set("maxPrice", String(params.maxPrice));
  if (params.availability) searchParams.set("availability", params.availability);
  searchParams.set("limit", String(limit));
  searchParams.set("page", String(page));
  return searchParams.toString() ? `?${searchParams.toString()}` : "";
}

export function useInfiniteProducts(
  params: ProductQueryParams = {},
  options: UseInfiniteProductsOptions = {},
) {
  const limit = params.limit ?? 30;
  return useInfiniteQuery({
    queryKey: ["products-infinite", params],
    queryFn: ({ pageParam = 0 }) =>
      fetchProducts(buildQueryString(params, Number(pageParam) || 0, limit)),
    staleTime: options.staleTime ?? 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialPageParam: 0,
    ...(options.initialData
      ? {
          initialData: {
            pages: [options.initialData],
            pageParams: [0],
          },
        }
      : {}),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < limit ? undefined : allPages.length,
  });
}
