import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { TimesheetFilterPresetController } from "./timesheetFilterPresets.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", TimesheetFilterPresetController.getAll);
router.post("/", TimesheetFilterPresetController.create);
router.put("/:id", TimesheetFilterPresetController.update);
router.delete("/:id", TimesheetFilterPresetController.remove);

export default router;
