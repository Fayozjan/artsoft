import { Router } from "express";
import multer from "multer";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { DepartmentsController } from "./departments.controller.js";

const uploadExcel = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", DepartmentsController.getDepartments);
router.get("/active", DepartmentsController.getActiveDepartments);
router.get("/staffing-overview", DepartmentsController.getStaffingOverview);
router.get("/:id", DepartmentsController.getDepartment);
router.post("/import-excel", uploadExcel.single("file"), DepartmentsController.importExcel);
router.post("/", DepartmentsController.addDepartment);
router.put("/:id", DepartmentsController.editDepartment);
router.delete("/:id", DepartmentsController.deleteDepartment);

export default router;
