import express from "express";
import * as productionCalendarController from "./productionCalendar.controller.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", productionCalendarController.getCalendar);
router.get("/norm", productionCalendarController.getNorm);
router.post("/days", productionCalendarController.saveDays);
router.delete("/days", productionCalendarController.resetDays);
router.delete("/year/:year", productionCalendarController.resetYear);

export default router;
