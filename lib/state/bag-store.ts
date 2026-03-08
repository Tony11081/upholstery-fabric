import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type BagItem = {
  lineId: string;
  productId: string;
  slug?: string;
  title: string;
  price: number;
  currency: string;
  quantity: number;
  image?: string;
  badge?: string;
  options?: Record<string, string>;
};

type BagState = {
  items: BagItem[];
  addItem: (item: Omit<BagItem, "lineId"> & { lineId?: string }) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clear: () => void;
  totals: () => { subtotal: number; count: number };
};

function normalizeOptions(options?: Record<string, string>) {
  if (!options) return undefined;
  const pairs = Object.entries(options)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => Boolean(key) && Boolean(value))
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  if (pairs.length === 0) return undefined;

  return Object.fromEntries(pairs);
}

export function buildBagLineId(productId: string, options?: Record<string, string>) {
  const normalized = normalizeOptions(options);
  if (!normalized) return productId;
  const query = Object.entries(normalized)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
  return `${productId}::${query}`;
}

const fallbackStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
};

export const useBagStore = create<BagState>()(
  persist<BagState>(
    (set, get) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const normalizedOptions = normalizeOptions(item.options);
          const lineId =
            item.lineId ??
            buildBagLineId(item.productId, normalizedOptions);
          const existing = state.items.find((entry) => entry.lineId === lineId);
          if (existing) {
            return {
              items: state.items.map((entry) =>
                entry.lineId === lineId
                  ? {
                      ...entry,
                      quantity: entry.quantity + item.quantity,
                      badge: item.badge ?? entry.badge,
                      options: normalizedOptions ?? entry.options,
                    }
                  : entry,
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                ...item,
                lineId,
                options: normalizedOptions,
              },
            ],
          };
        }),
      updateQuantity: (lineId, quantity) =>
        set((state) => ({
          items: state.items
            .map((entry) => (entry.lineId === lineId ? { ...entry, quantity } : entry))
            .filter((entry) => entry.quantity > 0),
        })),
      removeItem: (lineId) =>
        set((state) => ({
          items: state.items.filter((entry) => entry.lineId !== lineId),
        })),
      clear: () => set({ items: [] }),
      totals: () => {
        const { items } = get();
        const subtotal = items.reduce((sum, entry) => sum + entry.price * entry.quantity, 0);
        const count = items.reduce((sum, entry) => sum + entry.quantity, 0);
        return { subtotal, count };
      },
    }),
    {
      name: "uootd-bag",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? fallbackStorage : localStorage,
      ),
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as { items?: Array<Omit<BagItem, "lineId"> & { lineId?: string }> } | undefined;
        const items = (state?.items ?? []).map((item) => {
          const normalizedOptions = normalizeOptions(item.options);
          const lineId = item.lineId ?? buildBagLineId(item.productId, normalizedOptions);
          return {
            ...item,
            lineId,
            options: normalizedOptions,
          };
        });
        return {
          items,
        } as unknown as BagState;
      },
    },
  ),
);
