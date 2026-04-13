import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import {
  getTimesheet,
  getTimesheetByEmployees,
} from "./timesheet.controller.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", getTimesheet);
router.post("/by-employees", getTimesheetByEmployees);

export default router;
