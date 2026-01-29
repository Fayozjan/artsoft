import express from "express";
import pool from "../db.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

import { authMiddleware } from "../middlewares/authMiddleware.js";

dotenv.config();
const router = express.Router();

router.get("/validate-token", (req, res) => {
  const token = req.cookies.authToken;

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Token is not valid" });
    }

    // Возвращаем роль или другие данные пользователя
    res.json({ role: user.role, user_id: user.id });
  });
});

router.post("/login", async (req, res) => {
  const { username, password, language } = req.body;

  // 1. Проверяем логин
  const user = await prisma.users.findUnique({
    where: { username, status: true },
    select: {
      id: true,
      username: true,
      password: true,
      language: true,
      theme: true,
      sidebar: true,
    },
  });

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // 2. Если передан язык — обновляем
  let updatedUser = user;
  if (language && language !== user.language) {
    updatedUser = await prisma.users.update({
      where: { id: user.id },
      data: { language },
    });
  }

  // 3. Генерируем refresh
  const refreshToken = jwt.sign({ id: user.id }, process.env.REFRESH_SECRET, {
    expiresIn: "8h",
  });

  await prisma.sessions.create({
    data: {
      user_id: user.id,
      refresh_token: refreshToken,
      ip_address: req.ip,
      user_agent: req.headers["user-agent"] || "",
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 8),
    },
  });

  // 4. Генерируем access
  const accessToken = jwt.sign(
    { id: user.id, username: user.username },
    process.env.ACCESS_SECRET,
    { expiresIn: "15m" }
  );

  // 5. Ставим Access в cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000,
  });

  // Для продакшена
  /* 
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 8 * 60 * 60 * 1000,
  });
  */

  res.status(200).json({
    success: true,
    accessToken,
    language: updatedUser.language || null,
    theme: updatedUser.theme || null,
    sidebar: updatedUser.sidebar || null,
  });
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true },
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token required" });
    }

    // 1. Проверяем подпись Refresh Token
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    } catch (err) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    // 2. Проверяем сессию в базе
    const session = await prisma.sessions.findFirst({
      where: {
        user_id: payload.id,
        refresh_token: refreshToken,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"] || "",
        expires_at: {
          gt: new Date(), // expires_at > NOW()
        },
      },
    });

    if (!session) {
      return res.status(401).json({ message: "Session not found or expired" });
    }

    // 3. Генерируем новый Access Token
    const newAccessToken = jwt.sign(
      { id: payload.id },
      process.env.ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    // 4. Возвращаем новый Access Token
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(200).json({ message: "Already logged out" });
    }

    // 1. Проверяем подпись (не обязательно, можно сразу удалить)
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    } catch (err) {
      // даже если токен битый — удаляем cookie
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: false, // true в продакшене
        sameSite: "lax",
      });
      return res.status(200).json({ message: "Logged out" });
    }

    // 2. Удаляем сессию из базы
    await pool.query(
      `DELETE FROM sessions 
       WHERE user_id = $1 
       AND refresh_token = $2 
       AND ip_address = $3 
       AND user_agent = $4`,
      [payload.id, refreshToken, req.ip, req.headers["user-agent"]]
    );

    // 3. Чистим куку
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false, // true в продакшене
      sameSite: "lax",
    });

    res.status(200).json({ message: "Logged out" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
