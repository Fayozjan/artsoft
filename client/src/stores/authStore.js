import { create } from "zustand";
import { getUserInfo, getUserAccess, updateProfile } from "../api";
import api from "../api/instance";

export const useAuthStore = create((set, get) => ({
  // === STATE ===
  isAuthenticated: false,
  isLoggingOut: false,
  userSettings: {
    language: localStorage.getItem("language") || "ru",
    theme: localStorage.getItem("theme") || "light",
    sidebar: localStorage.getItem("sidebar") === "false" ? false : true,
    viewMode: "branch",
    activeBranchId: null,
  },
  access: null,
  user: null,
  error: null,

  setViewMode: (mode) => {
    set((state) => ({
      userSettings: { ...state.userSettings, viewMode: mode },
    }));

    updateProfile({ view_mode: mode });
  },

  setActiveBranch: (branchId) => {
    set((state) => ({
      userSettings: {
        ...state.userSettings,
        activeBranchId: branchId,
      },
    }));

    updateProfile({ active_branch_id: branchId });
  },

  setSidebarState: (isOpen) => {
    set((state) => ({
      userSettings: { ...state.userSettings, sidebar: isOpen },
    }));
    localStorage.setItem("sidebar", isOpen);
  },

  setUserSettings: (settings) => {
    set((state) => ({ userSettings: { ...state.userSettings, ...settings } }));
    if (settings.theme) localStorage.setItem("theme", settings.theme);
    if (settings.language) localStorage.setItem("language", settings.language);
    if (settings.sidebar !== undefined)
      localStorage.setItem("sidebar", settings.sidebar);
  },

  getUserSettings: () => get().userSettings,

  loadAccess: async () => {
    try {
      const access = await getUserAccess();

      set((state) => ({
        access,
        userSettings: {
          ...state.userSettings,
          viewMode: access.view_mode,
          activeBranchId: access.active_branch_id || null,
        },
      }));
    } catch (err) {
      console.error("Ошибка загрузки доступа:", err);
    }
  },

  // === ЗАГРУЗКА ПОЛЬЗОВАТЕЛЯ ===
  loadUser: async () => {
    try {
      const userRes = await getUserInfo({ withCredentials: true });
      set({ user: userRes, isAuthenticated: true });
      await get().loadAccess();
      return userRes;
    } catch (err) {
      console.error("Ошибка загрузки данных пользователя:", err);
      set({ user: null, isAuthenticated: false });
      return null;
    }
  },

  // === LOGIN ===
  loginUser: async (credentials) => {
    try {
      const { data } = await api.post("/auth/login", credentials, {
        withCredentials: true,
      });

      set({
        isAuthenticated: true,
        userSettings: {
          language: data.language,
          theme: data.theme,
          sidebar: data.sidebar,
          viewMode: "",
          activeBranchId: null,
        },
        user:
          {
            first_name: data?.first_name,
            last_name: data?.last_name,
            middle_name: data?.middle_name,
            position: data?.position,
            photo: data?.photo,
          } || null,
        error: null,
      });

      // сохраняем только UI-настройки
      localStorage.setItem("theme", data.theme);
      localStorage.setItem("language", data.language);
      localStorage.setItem("sidebar", data.sidebar);

      await get().loadAccess();

      return { success: true };
    } catch (error) {
      console.error("Ошибка при авторизации:", error);
      set({
        isAuthenticated: false,
        user: null,
        error: error.response?.data || "Ошибка",
      });
      return { success: false };
    }
  },

  // === LOGIN TELEGRAM ===
  loginTelegram: async (credentials) => {
    try {
      const { data } = await api.post("/auth/telegram", credentials, {
        withCredentials: true,
      });

      // Токены теперь в куках — localStorage не нужен
      set({
        isAuthenticated: true,
        user:
          {
            first_name: data?.first_name,
            last_name: data?.last_name,
            middle_name: data?.middle_name,
            position: data?.position,
            photo: data?.photo,
          } || null,
        userSettings: {
          language: data?.language || localStorage.getItem("language") || "ru",
          theme: data?.theme || localStorage.getItem("theme") || "light",
          sidebar: data?.sidebar ?? true,
          viewMode: "",
          activeBranchId: null,
        },
        error: null,
      });

      if (data?.language) localStorage.setItem("language", data.language);
      if (data?.theme) localStorage.setItem("theme", data.theme);
      if (data?.sidebar !== undefined)
        localStorage.setItem("sidebar", data.sidebar);

      await get().loadAccess();

      return { success: true };
    } catch (error) {
      console.error("Ошибка при авторизации:", error);
      set({
        isAuthenticated: false,
        user: null,
        error: error.response?.data || "Ошибка",
      });
      return { success: false };
    }
  },

  // === LOGOUT ===
  logout: async (navigate) => {
    set({ isLoggingOut: true });
    try {
      await api.post("/auth/logout", {}, { withCredentials: true });
    } catch (err) {
      console.error("Ошибка при логауте:", err);
    }

    set({
      isAuthenticated: false,
      isLoggingOut: false,
      user: null,
      userSettings: {
        language: "ru",
        theme: "light",
        sidebar: true,
        viewMode: "branch",
        activeBranchId: null,
      },
      error: null,
    });

    localStorage.removeItem("theme");
    localStorage.removeItem("language");
    localStorage.removeItem("sidebar");

    if (navigate) navigate("/", { replace: true });
  },
}));
