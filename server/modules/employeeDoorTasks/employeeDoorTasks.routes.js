import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { EmployeeDoorTasksController } from "./employeeDoorTasks.controller.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";

const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.post("/", EmployeeDoorTasksController.create);
router.get("/pending", EmployeeDoorTasksController.getPending);
router.put("/:id", EmployeeDoorTasksController.update);
router.delete("/", EmployeeDoorTasksController.deleteMany);

export default router;
