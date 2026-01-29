import { create } from "zustand";

export const useSidebarStore = create((set, get) => ({
  isOpen: false,
  leftPanelType: null, // 'list', 'transfer', 'terminate' или null
  isDirty: false, // Флаг наличия правок в EditEmployee

  // Экшены
  openSidebar: () => set({ isOpen: true, leftPanelType: null, isDirty: false }),
  closeSidebar: () =>
    set({ isOpen: false, leftPanelType: null, isDirty: false }),

  setLeftPanel: (type) => set({ leftPanelType: type }),
  setDirty: (dirty) => set({ isDirty: dirty }),

  // Логика закрытия: возвращает true, если можно закрыть всё сразу
  // Или false, если нужно показать подтверждение
  requestClose: () => {
    const { leftPanelType, isDirty } = get();

    // 1. Если открыта левая панель — закрываем только её
    if (leftPanelType) {
      set({ leftPanelType: null });
      return { canCloseAll: false };
    }

    // 2. Если левая закрыта, проверяем правки в основной
    if (isDirty) {
      return { canCloseAll: false, showConfirm: true };
    }

    // 3. Если правок нет, закрываем всё
    set({ isOpen: false });
    return { canCloseAll: true };
  },
}));
