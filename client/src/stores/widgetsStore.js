import { create } from "zustand";

const STORAGE_KEY = "widgetsVisible";

// Виджеты (statsGrid) прячутся глобально: на ноутбуках они съедают
// половину экрана, а таблица — основной контент страницы.
const readStored = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
};

export const useWidgetsStore = create((set, get) => ({
  widgetsVisible: readStored(),

  setWidgetsVisible: (visible) => {
    localStorage.setItem(STORAGE_KEY, visible);
    set({ widgetsVisible: visible });
  },

  toggleWidgets: () => get().setWidgetsVisible(!get().widgetsVisible),
}));
