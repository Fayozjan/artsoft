import { AuthModel } from "./auth.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createAuditLog } from "../../utils/auditLog.js";

const signTokens = (userId, username) => {
  const accessToken = jwt.sign(
    { id: userId, username },
    process.env.ACCESS_SECRET,
    { expiresIn: "15m" },
  );
  const refreshToken = jwt.sign({ id: userId }, process.env.REFRESH_SECRET, {
    expiresIn: "8h",
  });
  return { accessToken, refreshToken };
};

export const AuthService = {
  login: async (username, password, language, theme) => {
    const user = await AuthModel.findUserByUsername(username);

    if (!user) {
      throw {
        status: 403,
        code: "NOT_REGISTERED",
        message: "Not registered. Contact your administrator.",
      };
    }

    if (!user.status) {
      throw { status: 403, code: "DISABLED", message: "Account is disabled." };
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      throw {
        status: 401,
        message: "Invalid credentials",
        code: "AUTH_INVALID_CREDENTIALS",
      };

    if (language && language !== user.language) {
      user.language = (
        await AuthModel.updateUserLanguage(user.id, language)
      ).language;
    }

    if (theme && theme !== user.theme) {
      user.theme = (
        await AuthModel.updateUserTheme(user.id, theme)
      ).theme;
    }

    const refreshToken = jwt.sign({ id: user.id }, process.env.REFRESH_SECRET, {
      expiresIn: "8h",
    });
    await AuthModel.createSession({ userId: user.id, refreshToken });

    const accessToken = jwt.sign(
      { id: user.id, username: user.username },
      process.env.ACCESS_SECRET,
      { expiresIn: "15m" },
    );

    await createAuditLog({
      userId: user.id, action: "login", entity: "auth", recordId: user.id,
      newData: { username: user.username },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user?.id,
        language: user?.language,
        theme: user?.theme,
        sidebar: user?.sidebar,
        access_level: user?.access_level,
        employee_id: user?.employee_id,
        first_name: user?.employee?.first_name,
        last_name: user?.employee?.last_name,
        middle_name: user?.employee?.middle_name,
        position: user?.employee?.position?.name,
        photo: user?.employee?.photo,
      },
    };
  },

  telegramLogin: async (id) => {
    const telegramId = String(id);

    const user = await AuthModel.findUserByTelegramId(telegramId);

    if (!user) {
      throw {
        status: 403,
        code: "NOT_REGISTERED",
        message: "Not registered. Contact your administrator.",
      };
    }

    if (!user.status) {
      throw { status: 403, code: "DISABLED", message: "Account is disabled." };
    }

    const { accessToken, refreshToken } = signTokens(user.id, user.username);
    await AuthModel.createSession({ userId: user.id, refreshToken });

    await createAuditLog({
      userId: user.id, action: "login", entity: "auth", recordId: user.id,
      newData: { username: user.username, via: "telegram" },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        language: user.language,
        theme: user.theme,
        sidebar: user.sidebar,
        first_name: user.employee?.first_name,
        last_name: user.employee?.last_name,
        middle_name: user.employee?.middle_name,
        position: user.employee?.position?.name,
        photo: user.employee?.photo,
      },
    };
  },

  logout: async (refreshToken) => {
    if (!refreshToken) return;
    try {
      const payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
      await AuthModel.deleteSession({ userId: payload.id, refreshToken });
      await createAuditLog({
        userId: payload.id, action: "logout", entity: "auth", recordId: payload.id,
      });
    } catch {
      // Игнорируем ошибки
    }
  },

  refresh: async (refreshToken) => {
    if (!refreshToken) throw { status: 401, message: "Refresh token required" };

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    } catch {
      throw { status: 403, message: "Invalid refresh token" };
    }

    const session = await AuthModel.findSession({
      userId: payload.id,
      refreshToken,
    });
    if (!session)
      throw { status: 401, message: "Session not found or expired" };

    // Новый refresh token (опционально)
    const newRefreshToken = jwt.sign(
      { id: payload.id },
      process.env.REFRESH_SECRET,
      { expiresIn: "8h" },
    );
    await AuthModel.updateSession(payload.id, refreshToken, newRefreshToken);

    const accessToken = jwt.sign(
      { id: payload.id },
      process.env.ACCESS_SECRET,
      {
        expiresIn: "15m",
      },
    );

    return { accessToken, refreshToken: newRefreshToken };
  },

  getMe: async (userId) => {
    const user = await AuthModel.findUserById(userId);
    if (!user) throw { status: 404, message: "User not found" };
    return user;
  },
};
