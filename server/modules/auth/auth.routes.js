import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";

const router = Router();

router.post("/login", tenantMiddleware, AuthController.login);
router.post("/telegram", AuthController.telegramLogin);
router.post("/logout", tenantMiddleware, AuthController.logout);
router.post("/refresh", tenantMiddleware, AuthController.refresh);
router.get("/me", tenantMiddleware, authMiddleware, AuthController.me);

export default router;
