import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import * as menusController from "./menus.controller.js";

const router = Router();

router.get("/", authMiddleware, menusController.getMenus);

export default router;
