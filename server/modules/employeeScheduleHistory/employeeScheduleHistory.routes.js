import express from "express";
import { EmployeeWorkScheduleHistoryController } from "./employeeScheduleHistory.controller.js";

const router = express.Router();

router.delete("/:id", EmployeeWorkScheduleHistoryController.deleteById);

export default router;
