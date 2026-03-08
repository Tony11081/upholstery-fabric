import { create } from "zustand";

type UIState = {
  isFilterOpen: boolean;
  isSortOpen: boolean;
  isShareOpen: boolean;
  setFilterOpen: (open: boolean) => void;
  setSortOpen: (open: boolean) => void;
  setShareOpen: (open: boolean) => void;
};

export const useUIStore = create<UIState>()((set) => ({
  isFilterOpen: false,
  isSortOpen: false,
  isShareOpen: false,
  setFilterOpen: (isFilterOpen) => set({ isFilterOpen }),
  setSortOpen: (isSortOpen) => set({ isSortOpen }),
  setShareOpen: (isShareOpen) => set({ isShareOpen }),
}));
