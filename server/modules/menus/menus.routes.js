import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import * as menusController from "./menus.controller.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";

const router = Router();

router.get("/", tenantMiddleware, authMiddleware, menusController.getMenus);

export default router;
