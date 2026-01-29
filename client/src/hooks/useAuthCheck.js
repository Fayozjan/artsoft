import { useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";

import api from "../api/instance";

export const useAuthCheck = () => {
  const { accessToken, setAccessToken, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const verify = async () => {
      try {
        if (!accessToken) {
          const res = await api.post("/auth/refresh");
          setAccessToken(res.data.accessToken);
        }
        await api.get("/auth/me");
        setIsAuth(true);
      } catch {
        logout();
        setIsAuth(false);
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [accessToken, setAccessToken, logout]);

  return { loading, isAuth };
};
