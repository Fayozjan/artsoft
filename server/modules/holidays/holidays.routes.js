import express from "express";
import * as holidaysController from "./holidays.controller.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", holidaysController.getHolidays);
router.get("/:id", holidaysController.getHoliday);
router.post("/", holidaysController.addHoliday);
router.put("/:id", holidaysController.updateHoliday);
router.delete("/:id", holidaysController.removeHoliday);

export default router;
