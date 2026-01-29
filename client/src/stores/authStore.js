import { create } from "zustand";
import axios from "axios";

export const useAuthStore = create((set, get) => ({
  isAuthenticated: false,
  accessToken: localStorage.getItem("accessToken") || null,
  userSettings: {
    language: localStorage.getItem("language") || "ru",
    theme: localStorage.getItem("theme") || "light",
    sidebar: localStorage.getItem("sidebar") === "false" ? false : true,
  },

  setSidebarState: (isOpen) => {
    set((state) => ({
      userSettings: {
        ...state.userSettings,
        sidebar: isOpen,
      },
    }));
    localStorage.setItem("sidebar", isOpen);
  },

  setAccessToken: (token) => {
    set({ accessToken: token, isAuthenticated: !!token });
    if (token) {
      localStorage.setItem("accessToken", token);
    } else {
      localStorage.removeItem("accessToken");
    }
  },

  loginUser: async (credentials) => {
    try {
      const { data } = await axios.post("/api/auth/login", credentials, {
        withCredentials: true,
      });

      if (data.success && data.accessToken) {
        set({
          isAuthenticated: true,
          accessToken: data.accessToken,
          userSettings: {
            language: data.language,
            theme: data.theme,
            sidebar: data.sidebar,
          },
          error: null,
        });

        // сохраняем токен и настройки в localStorage
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("theme", data.theme);
        localStorage.setItem("language", data.language);
        localStorage.setItem("sidebar", data.sidebar);

        return { success: true };
      }
      return { success: false };
    } catch (error) {
      console.error("Ошибка при авторизации:", error);
      set({
        isAuthenticated: false,
        accessToken: null,
        error: error.response?.data || "Ошибка",
        userSettings: null,
      });
      localStorage.removeItem("accessToken");
      return { success: false };
    }
  },

  setUserSettings: (settings) => {
    set((state) => ({
      ...state,
      userSettings: {
        ...state.userSettings,
        ...settings,
      },
    }));

    localStorage.setItem("theme", settings.theme);
    localStorage.setItem("language", settings.language);
    localStorage.setItem("sidebar", settings.sidebar);
  },

  getUserSettings: () => get().userSettings,

  logout: async () => {
    try {
      await axios.post("/api/auth/logout", {}, { withCredentials: true });
    } catch {}
    set({
      isAuthenticated: false,
      accessToken: null,
      error: null,
    });
    localStorage.removeItem("accessToken");
  },
}));
