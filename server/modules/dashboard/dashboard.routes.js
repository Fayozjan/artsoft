import { Router } from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { DashboardController } from "./dashboard.controller.js";

const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/all", DashboardController.all);
router.get("/summary", DashboardController.summary);
router.get("/analytics", DashboardController.analytics);
router.get("/feeds", DashboardController.feeds);
router.get("/finance", DashboardController.finance);

export default router;
