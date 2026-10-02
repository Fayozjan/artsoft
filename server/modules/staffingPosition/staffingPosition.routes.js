import { Router } from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { StaffingPositionController } from "./staffingPosition.controller.js";

const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/department/:id", StaffingPositionController.getByDepartment);
router.put("/department/:id", StaffingPositionController.bulkUpsert);

export default router;
