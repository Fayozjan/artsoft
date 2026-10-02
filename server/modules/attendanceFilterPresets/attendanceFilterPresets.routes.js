import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { AttendanceFilterPresetController } from "./attendanceFilterPresets.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", AttendanceFilterPresetController.getAll);
router.post("/", AttendanceFilterPresetController.create);
router.put("/:id", AttendanceFilterPresetController.update);
router.delete("/:id", AttendanceFilterPresetController.remove);

export default router;
