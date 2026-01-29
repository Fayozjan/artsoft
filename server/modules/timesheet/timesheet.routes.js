import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import {
  getTimesheet,
  getTimesheetByEmployees,
} from "./timesheet.controller.js";

const router = express.Router();

router.get("/", authMiddleware, getTimesheet);
router.post("/by-employees", getTimesheetByEmployees);

export default router;
