import { create } from "zustand";

export const useAlertStore = create((set) => ({
  visible: false,
  message: "",
  type: "success",
  showAlert: (message, type = "success") =>
    set({ visible: true, message, type }),
  hideAlert: () => set({ visible: false, message: "", type: "info" }),
}));
