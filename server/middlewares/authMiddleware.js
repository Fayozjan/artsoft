import jwt from "jsonwebtoken";
import { prismaContext } from "../utils/prismaContext.js";
import dotenv from "dotenv";

dotenv.config();

export const authMiddleware = async (req, res, next) => {
  try {
    const prisma = prismaContext.get();
    let token =
      req.headers.authorization?.split(" ")[1] || req.cookies?.accessToken;

    if (!token) return res.status(401).json({ message: "No token provided" });

    let payload;
    try {
      payload = jwt.verify(token, process.env.ACCESS_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = await prisma.users.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        username: true,
        language: true,
        theme: true,
        sidebar: true,
      },
    });

    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Для фоток/дополнительно проверяем cookie
export const authPhotoMiddleware = async (req, res, next) => {
  try {
    const prisma = prismaContext.get();

    let token;
    if (req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) return res.status(401).json({ message: "No token provided" });

    let payload;
    try {
      payload = jwt.verify(token, process.env.ACCESS_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid token" });
    }

    const user = await prisma.users.findUnique({
      where: { id: payload.id },
      select: { id: true, username: true },
    });

    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
