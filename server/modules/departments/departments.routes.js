import { Router } from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { DepartmentsController } from "./departments.controller.js";

const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", DepartmentsController.getDepartments);
router.get("/active", DepartmentsController.getActiveDepartments);
router.get("/:id", DepartmentsController.getDepartment);
router.post("/", DepartmentsController.addDepartment);
router.put("/:id", DepartmentsController.editDepartment);
router.delete("/:id", DepartmentsController.deleteDepartment);

export default router;
