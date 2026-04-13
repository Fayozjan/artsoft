import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { AttendanceController } from "./attendance.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", AttendanceController.getAttendance);
router.get(
  "/employee/:employeeId",
  AttendanceController.getAttendanceByEmployeeId,
);

export default router;
