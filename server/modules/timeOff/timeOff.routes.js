import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import * as timeOffController from "./timeOff.controller.js";

const router = Router();

router.get("/", authMiddleware, timeOffController.getTimeOffs);
router.get("/:id", authMiddleware, timeOffController.getTimeOffById);
router.post("/", authMiddleware, timeOffController.createTimeOff);
router.put("/:id", authMiddleware, timeOffController.updateTimeOff);
router.delete("/:id", authMiddleware, timeOffController.deleteTimeOff);

export default router;
