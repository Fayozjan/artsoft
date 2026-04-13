import { Router } from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { EmploymentOrdersController } from "./employmentOrders.controller.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";

const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", EmploymentOrdersController.getAll);
router.get("/employee/:id", EmploymentOrdersController.getByEmployeeId);
router.get("/:id", EmploymentOrdersController.getById);
router.post("/", EmploymentOrdersController.create);
router.put("/:id", EmploymentOrdersController.update);
router.delete("/:id", EmploymentOrdersController.delete);

export default router;
