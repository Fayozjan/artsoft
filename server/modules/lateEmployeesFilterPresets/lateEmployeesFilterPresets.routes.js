import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { LateEmployeesFilterPresetController } from "./lateEmployeesFilterPresets.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", LateEmployeesFilterPresetController.getAll);
router.post("/", LateEmployeesFilterPresetController.create);
router.put("/:id", LateEmployeesFilterPresetController.update);
router.delete("/:id", LateEmployeesFilterPresetController.remove);

export default router;
