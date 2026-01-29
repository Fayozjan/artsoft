import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import * as workScheduleController from "./workSchedules.controller.js";

const router = Router();

router.get("/", authMiddleware, workScheduleController.getWorkSchedules);
router.get(
  "/active",
  authMiddleware,
  workScheduleController.getActiveWorkSchedules
);
router.get("/:id", authMiddleware, workScheduleController.getWorkSchedule);
router.post("/", authMiddleware, workScheduleController.addWorkSchedule);
router.put("/:id", authMiddleware, workScheduleController.editWorkSchedule);
router.delete(
  "/:id",
  authMiddleware,
  workScheduleController.removeWorkSchedule
);

export default router;
