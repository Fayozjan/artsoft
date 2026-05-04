import { AuthService } from "./auth.service.js";
import {
  prismaPublic,
  getPrismaForTenant,
} from "../../utils/prismaForTenant.js";
import { prismaContext } from "../../utils/prismaContext.js";

const setTokens = (res, accessToken, refreshToken) => {
  const secure = process.env.NODE_ENV === "production";

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000, // 8 часов
  });

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 15 * 60 * 1000, // 15 минут
  });
};

export const AuthController = {
  login: async (req, res) => {
    try {
      const { username, password, language } = req.body;
      const { accessToken, refreshToken, user } = await AuthService.login(
        username,
        password,
        language,
      );

      setTokens(res, accessToken, refreshToken);
      res.status(200).json(user);
    } catch (err) {
      console.error("Login error:", err);
      res.status(err.status || 401).json({ ...err });
    }
  },

  telegramLogin: async (req, res) => {
    try {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ message: "id required" });
      }

      const telegramId = String(id);

      const tenantUser = await prismaPublic.tenant_telegram_users.findUnique({
        where: { telegram_id: telegramId },
        include: { tenant: true },
      });

      if (!tenantUser) {
        return res.status(403).json({
          code: "NOT_REGISTERED",
          message: "Not registered. Contact your administrator.",
        });
      }

      const prisma = getPrismaForTenant(tenantUser.tenant.schema);

      await prismaContext.run(prisma, async () => {
        const { accessToken, refreshToken, user } =
          await AuthService.telegramLogin(telegramId);
        setTokens(res, accessToken, refreshToken);
        res.status(200).json(user);
      });
    } catch (err) {
      console.error("Telegram login error:", err);
      res.status(err.status || 500).json({
        code: err.code || "ERROR",
        message: err.message,
      });
    }
  },

  logout: async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      await AuthService.logout(refreshToken);

      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");

      res.status(200).json({ message: "Logged out" });
    } catch (err) {
      console.error("Logout error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },

  refresh: async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      const { accessToken, refreshToken: newRefreshToken } =
        await AuthService.refresh(refreshToken);

      setTokens(res, accessToken, newRefreshToken);
      res.json({ success: true });
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  },

  me: async (req, res) => {
    try {
      const user = await AuthService.getMe(req.user.id);
      res.json({
        language: user.language,
        theme: user.theme,
        sidebar: user.sidebar,
      });
    } catch (err) {
      console.error("Me error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
};
