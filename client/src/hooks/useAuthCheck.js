import { useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import api from "../api/instance";

export const useAuthCheck = () => {
  const { logout, isLoggingOut, isAuthenticated, setUserSettings } =
    useAuthStore();
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    if (isLoggingOut) {
      setLoading(false);
      setIsAuth(false);
      return;
    }

    // Если стор уже знает что авторизован — не делаем лишний запрос
    if (isAuthenticated) {
      setIsAuth(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const verify = async () => {
      try {
        const res = await api.get("/auth/me");

        if (cancelled) return;
        setUserSettings(res.data);
        setIsAuth(true);
      } catch {
        if (!cancelled) {
          logout();
          setIsAuth(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, [isLoggingOut, isAuthenticated, logout, setUserSettings]);

  return { loading, isAuth };
};
