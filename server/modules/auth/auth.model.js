import { prismaContext } from "../../utils/prismaContext.js";

export const AuthModel = {
  findUserByUsername: async (username) => {
    const prisma = prismaContext.get();
    return prisma.users.findUnique({
      where: { username, status: true },
      select: {
        id: true,
        username: true,
        password: true,
        language: true,
        theme: true,
        sidebar: true,
        employee: {
          select: {
            first_name: true,
            last_name: true,
            middle_name: true,
            position: true,
            photo: true,
          },
        },
      },
    });
  },

  findUserByTelegramId: async (telegramId) => {
    const prisma = prismaContext.get();
    return prisma.users.findUnique({
      where: { telegram_id: telegramId },
      select: {
        id: true,
        username: true,
        status: true,
        language: true,
        theme: true,
        sidebar: true,
        employee: {
          select: {
            first_name: true,
            last_name: true,
            middle_name: true,
            position: { select: { name: true } },
            photo: true,
          },
        },
      },
    });
  },

  updateUserLanguage: async (userId, language) => {
    const prisma = prismaContext.get();
    return prisma.users.update({
      where: { id: userId },
      data: { language },
    });
  },

  createSession: async ({ userId, refreshToken, ip, userAgent }) => {
    const prisma = prismaContext.get();
    return prisma.sessions.create({
      data: {
        user_id: userId,
        refresh_token: refreshToken,
        ip_address: ip,
        user_agent: userAgent,
        expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000),
      },
    });
  },

  updateSession: async (
    userId,
    oldRefreshToken,
    newRefreshToken,
    ip,
    userAgent,
  ) => {
    const prisma = prismaContext.get();
    return prisma.sessions.updateMany({
      where: {
        user_id: userId,
        refresh_token: oldRefreshToken,
        ip_address: ip,
        user_agent: userAgent,
      },
      data: {
        refresh_token: newRefreshToken,
        expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000),
      },
    });
  },

  deleteSession: async ({ userId, refreshToken, ip, userAgent }) => {
    const prisma = prismaContext.get();
    return prisma.sessions.deleteMany({
      where: {
        user_id: userId,
        refresh_token: refreshToken,
        ip_address: ip,
        user_agent: userAgent,
      },
    });
  },

  findSession: async ({ userId, refreshToken, ip, userAgent }) => {
    const prisma = prismaContext.get();
    return prisma.sessions.findFirst({
      where: {
        user_id: userId,
        refresh_token: refreshToken,
        ip_address: ip,
        user_agent: userAgent,
        expires_at: { gt: new Date() },
      },
    });
  },

  findUserById: async (userId) => {
    const prisma = prismaContext.get();
    return prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });
  },
};
