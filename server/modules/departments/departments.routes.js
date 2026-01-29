import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import * as departmentsController from "./departments.controller.js";

const router = Router();

router.get("/", authMiddleware, departmentsController.getDepartments);
router.get(
  "/active",
  authMiddleware,
  departmentsController.getActiveDepartments
);
router.get("/:id", authMiddleware, departmentsController.getDepartment);
router.post("/", authMiddleware, departmentsController.addDepartment);
router.put("/:id", authMiddleware, departmentsController.editDepartment);
router.delete("/:id", authMiddleware, departmentsController.deleteDepartment);

export default router;
