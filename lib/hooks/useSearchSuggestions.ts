"use client";

import { useQuery } from "@tanstack/react-query";
import type { Category } from "@prisma/client";
import type { ProductListItem } from "@/lib/data/products";

type SuggestionsResponse = {
  products: ProductListItem[];
  categories: Category[];
  brands: string[];
};

async function fetchSuggestions(term: string) {
  const params = new URLSearchParams({ q: term });
  const res = await fetch(`/api/search?${params.toString()}`);
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as
      | { message?: string; error?: string; requestId?: string }
      | null;
    const message = data?.message ?? data?.error ?? "Unable to fetch search suggestions";
    const requestId = data?.requestId ? ` (ref: ${data.requestId})` : "";
    throw new Error(`${message}${requestId}`);
  }
  const data = (await res.json().catch(() => null)) as SuggestionsResponse | null;
  return (
    data ?? {
      products: [],
      categories: [],
      brands: [],
    }
  );
}

export function useSearchSuggestions(term: string) {
  return useQuery({
    queryKey: ["search-suggestions", term],
    queryFn: () => fetchSuggestions(term),
    enabled: term.trim().length > 0,
  });
}
