import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Address = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
};

export type ShippingMethod = {
  id: string;
  label: string;
  eta: string;
  price: number;
};

type CheckoutState = {
  address: Address | null;
  shipping: ShippingMethod | null;
  setAddress: (address: Address) => void;
  setShipping: (shipping: ShippingMethod) => void;
  clear: () => void;
};

const fallbackStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
};

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set) => ({
      address: null,
      shipping: null,
      setAddress: (address) => set({ address }),
      setShipping: (shipping) => set({ shipping }),
      clear: () => set({ address: null, shipping: null }),
    }),
    {
      name: "uootd-checkout",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? fallbackStorage : localStorage,
      ),
      version: 1,
    },
  ),
);
