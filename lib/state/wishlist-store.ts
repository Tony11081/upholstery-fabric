"use client";

import { create } from "zustand";

type WishlistState = {
  productIds: string[];
  hydrated: boolean;
  loading: boolean;
  signedIn: boolean | null;
  load: () => Promise<void>;
  addLocal: (productId: string) => void;
  removeLocal: (productId: string) => void;
};

export const useWishlistStore = create<WishlistState>((set, get) => ({
  productIds: [],
  hydrated: false,
  loading: false,
  signedIn: null,
  load: async () => {
    const { hydrated, loading } = get();
    if (hydrated || loading) return;
    set({ loading: true });
    try {
      const res = await fetch("/api/wishlist");
      if (res.status === 401) {
        set({ productIds: [], hydrated: true, loading: false, signedIn: false });
        return;
      }
      if (!res.ok) {
        throw new Error("Unable to load wishlist");
      }
      const data = (await res.json()) as { productIds?: string[] };
      set({
        productIds: Array.isArray(data.productIds) ? data.productIds : [],
        hydrated: true,
        loading: false,
        signedIn: true,
      });
    } catch {
      set({ hydrated: true, loading: false });
    }
  },
  addLocal: (productId) =>
    set((state) => ({
      productIds: state.productIds.includes(productId)
        ? state.productIds
        : [...state.productIds, productId],
    })),
  removeLocal: (productId) =>
    set((state) => ({
      productIds: state.productIds.filter((id) => id !== productId),
    })),
}));
