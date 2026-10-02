import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { loginLockoutGuard } from "../../middlewares/loginLockout.js";
import {
  loginIpLimiter,
  telegramLoginLimiter,
  refreshLimiter,
} from "../../middlewares/rateLimiter.js";

const router = Router();

// tenantMiddleware до guard: ключ блокировки включает арендатора
router.post(
  "/login",
  loginIpLimiter,
  tenantMiddleware,
  loginLockoutGuard,
  AuthController.login,
);
router.post("/telegram", telegramLoginLimiter, AuthController.telegramLogin);
router.post("/logout", tenantMiddleware, AuthController.logout);
router.post("/refresh", refreshLimiter, tenantMiddleware, AuthController.refresh);
router.get("/me", tenantMiddleware, authMiddleware, AuthController.me);

export default router;
