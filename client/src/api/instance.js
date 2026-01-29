import axios from "axios";
import { useAuthStore } from "../stores/authStore";

const api = axios.create({ baseURL: "/api", withCredentials: true });

// --- Request interceptor ---
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// --- Response interceptor ---
api.interceptors.response.use(
  (response) => response, // успешные ответы
  async (error) => {
    const originalRequest = error.config;

    // Если access истёк (403) и ещё не пробовали рефреш
    if (
      [401, 403].includes(error.response?.status) &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        // дергаем refresh (refresh токен хранится в cookie, потому withCredentials: true)
        const res = await axios.post(
          "/api/auth/refresh",
          {},
          { withCredentials: true }
        );

        const newAccessToken = res.data.accessToken;

        // обновляем store
        useAuthStore.getState().setAccessToken(newAccessToken);

        // повторяем оригинальный запрос с новым токеном
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (err) {
        // refresh не сработал → выкидываем пользователя на логин
        useAuthStore.getState().logout();
        window.location.href = "/";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
