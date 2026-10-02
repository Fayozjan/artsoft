import { create } from "zustand";
import {
  getUserInfo,
  getUserAccess,
  updateProfile,
  getActiveBranches,
} from "../api";
import api from "../api/instance";
import { useFilterDataStore } from "./filterDataStore";

// Сервер хранит sidebar строкой ("opened"/"closed"), клиент — булевым
const normalizeSidebar = (value, fallback = true) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string")
    return value !== "closed" && value !== "false";
  return !!value;
};

// Расположение меню: слева / горизонтально сверху / скрыто (выезжает по кнопке)
export const SIDEBAR_POSITIONS = ["left", "top", "hidden"];

const normalizeSidebarPosition = (value) =>
  SIDEBAR_POSITIONS.includes(value) ? value : "left";

// Страница, которая открывается после входа (settings.startPage)
export const DEFAULT_START_PAGE = "/home";

export const normalizeStartPage = (value) =>
  typeof value === "string" && value.startsWith("/") && value !== "/"
    ? value
    : DEFAULT_START_PAGE;

export const useAuthStore = create((set, get) => ({
  // === STATE ===
  isAuthenticated: false,
  isLoggingOut: false,
  userSettings: {
    language: localStorage.getItem("language") || "ru",
    theme: localStorage.getItem("theme") || "light",
    sidebar: normalizeSidebar(localStorage.getItem("sidebar")),
    sidebarPosition: normalizeSidebarPosition(
      localStorage.getItem("sidebarPosition"),
    ),
    viewMode: "branch",
    activeBranchId: null,
    settings: {},
  },
  access: null,
  user: null,
  error: null,

  // Сервер отбирает сотрудников по view_mode/active_branch_id из БД, поэтому сначала
  // сохраняем, и только потом меняем состояние: страницы перезапрашивают данные по
  // смене activeBranchId и иначе получили бы выборку прежнего филиала.
  setViewMode: async (mode) => {
    try {
      await updateProfile({ view_mode: mode });
    } catch (err) {
      console.error("Ошибка смены режима отображения:", err);
      return;
    }

    await useFilterDataStore.getState().refresh();
    set((state) => ({
      userSettings: { ...state.userSettings, viewMode: mode },
    }));
  },

  setActiveBranch: async (branchId) => {
    try {
      await updateProfile({ active_branch_id: branchId });
    } catch (err) {
      console.error("Ошибка смены филиала:", err);
      return;
    }

    await useFilterDataStore.getState().refresh();
    set((state) => ({
      userSettings: {
        ...state.userSettings,
        activeBranchId: branchId,
      },
    }));
  },

  updateSettings: (key, value) => {
    const current = get().userSettings.settings || {};
    const updated = { ...current, [key]: value };
    set((state) => ({
      userSettings: { ...state.userSettings, settings: updated },
    }));
    updateProfile({ settings: updated });
  },

  setSidebarState: (isOpen) => {
    set((state) => ({
      userSettings: { ...state.userSettings, sidebar: isOpen },
    }));
    localStorage.setItem("sidebar", isOpen);

    updateProfile({ sidebar: isOpen ? "opened" : "closed" });
  },

  setSidebarPosition: (position) => {
    const next = normalizeSidebarPosition(position);
    const settings = { ...(get().userSettings.settings || {}), sidebarPosition: next };

    set((state) => ({
      userSettings: { ...state.userSettings, sidebarPosition: next, settings },
    }));
    localStorage.setItem("sidebarPosition", next);

    updateProfile({ settings });
  },

  setUserSettings: (settings) => {
    const sidebar =
      settings.sidebar !== undefined
        ? normalizeSidebar(settings.sidebar)
        : undefined;

    const sidebarPosition =
      settings.sidebarPosition !== undefined
        ? normalizeSidebarPosition(settings.sidebarPosition)
        : undefined;

    set((state) => ({
      userSettings: {
        ...state.userSettings,
        ...settings,
        ...(sidebar !== undefined ? { sidebar } : {}),
        ...(sidebarPosition !== undefined ? { sidebarPosition } : {}),
      },
    }));
    if (settings.theme) localStorage.setItem("theme", settings.theme);
    if (settings.language) localStorage.setItem("language", settings.language);
    if (sidebar !== undefined) localStorage.setItem("sidebar", sidebar);
    if (sidebarPosition !== undefined)
      localStorage.setItem("sidebarPosition", sidebarPosition);
  },

  getUserSettings: () => get().userSettings,

  loadAccess: async () => {
    try {
      const access = await getUserAccess();

      if (access.access_level === "absolute") {
        const allBranches = await getActiveBranches();
        access.branches = allBranches.data ?? [];
      }

      const sidebarPosition = normalizeSidebarPosition(
        access.settings?.sidebarPosition,
      );
      localStorage.setItem("sidebarPosition", sidebarPosition);

      set((state) => ({
        access,
        userSettings: {
          ...state.userSettings,
          viewMode: access.view_mode,
          activeBranchId: access.active_branch_id || null,
          settings: access.settings || {},
          sidebarPosition,
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
          sidebar: normalizeSidebar(data.sidebar),
          viewMode: "",
          activeBranchId: null,
          settings: {},
        },
        user: {
            id: data?.id,
            access_level: data?.access_level,
            employee_id: data?.employee_id,
            first_name: data?.first_name,
            last_name: data?.last_name,
            middle_name: data?.middle_name,
            position: data?.position,
            photo: data?.photo,
          },
        error: null,
      });

      // сохраняем только UI-настройки
      localStorage.setItem("theme", data.theme);
      localStorage.setItem("language", data.language);
      localStorage.setItem("sidebar", normalizeSidebar(data.sidebar));

      await get().loadAccess();

      return { success: true };
    } catch (error) {
      console.error("Ошибка при авторизации:", error);
      set({
        isAuthenticated: false,
        user: null,
        error: error.response?.data || "Ошибка",
      });
      const data = error.response?.data;

      return {
        success: false,
        status: error.response?.status,
        code: data?.code || error.code,
        // сколько ждать при блокировке за перебор пароля (429)
        retryAfter: data?.retryAfter,
        retryAfterMinutes: data?.retryAfterMinutes,
        // сколько попыток осталось до блокировки (401)
        attemptsLeft: data?.attemptsLeft,
      };
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
        user: {
            id: data?.id,
            access_level: data?.access_level,
            employee_id: data?.employee_id,
            first_name: data?.first_name,
            last_name: data?.last_name,
            middle_name: data?.middle_name,
            position: data?.position,
            photo: data?.photo,
          },
        userSettings: {
          language: data?.language || localStorage.getItem("language") || "ru",
          theme: data?.theme || localStorage.getItem("theme") || "light",
          sidebar: normalizeSidebar(data?.sidebar),
          viewMode: "",
          activeBranchId: null,
          settings: {},
        },
        error: null,
      });

      if (data?.language) localStorage.setItem("language", data.language);
      if (data?.theme) localStorage.setItem("theme", data.theme);
      if (data?.sidebar !== undefined)
        localStorage.setItem("sidebar", normalizeSidebar(data.sidebar));

      await get().loadAccess();

      return { success: true };
    } catch (error) {
      console.error("Ошибка при авторизации:", error);
      set({
        isAuthenticated: false,
        user: null,
        error: error.response?.data || "Ошибка",
      });
      return {
        success: false,
        errorCode: error.response?.data?.code,
        message: error.response?.data?.message,
        retryAfter: error.response?.data?.retryAfter,
        retryAfterMinutes: error.response?.data?.retryAfterMinutes,
      };
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
        settings: {},
        sidebar: true,
        sidebarPosition: "left",
        viewMode: "branch",
        activeBranchId: null,
      },
      error: null,
    });

    localStorage.removeItem("theme");
    localStorage.removeItem("language");
    localStorage.removeItem("sidebar");
    localStorage.removeItem("sidebarPosition");

    if (navigate) navigate("/", { replace: true });
  },
}));
