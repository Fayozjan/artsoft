import { Router } from "express";

import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { EmployeeEfficiencyController } from "./employeeEfficiency.controller.js";

const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/:employeeId", EmployeeEfficiencyController.get);

export default router;
