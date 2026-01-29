import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import * as telegramBotController from "./telegramBots.controller.js";

const router = express.Router();

router.get("/", authMiddleware, telegramBotController.getBots);
router.get("/:id", authMiddleware, telegramBotController.getBotById);
router.post("/", authMiddleware, telegramBotController.addBot);
router.put("/:id", authMiddleware, telegramBotController.updateBot);

export default router;
