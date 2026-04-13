import express from "express";
import { EmployeeWorkScheduleHistoryController } from "./employeeScheduleHistory.controller.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.delete("/:id", EmployeeWorkScheduleHistoryController.deleteById);

export default router;
