import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import * as telegramBotController from "./telegramBots.controller.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", telegramBotController.getBots);
router.get("/:id", telegramBotController.getBotById);
router.post("/", telegramBotController.addBot);
router.put("/:id", telegramBotController.updateBot);

export default router;
