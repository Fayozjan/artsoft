import { create } from "zustand";

export const useImagePreviewStore = create((set) => ({
  src: null,
  open: (src) => set({ src }),
  close: () => set({ src: null }),
}));
