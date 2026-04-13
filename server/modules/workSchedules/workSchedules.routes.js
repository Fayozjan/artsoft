import { Router } from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { workScheduleController } from "./workSchedules.controller.js";

const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", workScheduleController.getAll);
router.get("/active", workScheduleController.getActive);
router.get("/:id", workScheduleController.getById);
router.post("/", workScheduleController.create);
router.put("/:id", workScheduleController.updateById);
router.delete("/:id", workScheduleController.deleteById);

export default router;
