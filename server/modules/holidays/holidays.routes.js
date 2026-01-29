import express from "express";
import * as holidaysController from "./holidays.controller.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, holidaysController.getHolidays);
router.get("/:id", authMiddleware, holidaysController.getHoliday);
router.post("/", authMiddleware, holidaysController.addHoliday);
router.put("/:id", authMiddleware, holidaysController.updateHoliday);
router.delete("/:id", authMiddleware, holidaysController.removeHoliday);

export default router;
