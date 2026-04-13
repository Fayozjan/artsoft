import axios from "axios";
import { useAuthStore } from "../stores/authStore";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

let refreshPromise = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (
      [401, 403].includes(error.response?.status) &&
      !originalRequest._retry &&
      !originalRequest.url.includes("/auth/refresh") &&
      !originalRequest.url.includes("/auth/login")
    ) {
      originalRequest._retry = true;

      try {
        // если refresh уже идёт — ждём его, не запускаем новый
        if (!refreshPromise) {
          refreshPromise = api.post("/auth/refresh").finally(() => {
            refreshPromise = null;
          });
        }

        await refreshPromise;
        return api(originalRequest); // повторяем оригинальный запрос
      } catch {
        useAuthStore.getState().logout();
        window.location.href = "/";
      }
    }

    return Promise.reject(error);
  },
);

export default api;
