import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import * as employeesController from "./employees.controller.js";
import uploadPhoto from "../../middlewares/uploadPhoto.js";

import { EmployeeController } from "./employees.controller.js";

const router = Router();
const { upload, convertToJpg } = uploadPhoto("employees");

router.get("/", authMiddleware, employeesController.getEmployees);
router.get("/active", authMiddleware, employeesController.getActiveEmployees);
router.get("/:id", authMiddleware, EmployeeController.getByid);
router.post(
  "/",
  authMiddleware,
  upload,
  convertToJpg,
  employeesController.addEmployee,
);
router.put(
  "/:id",
  authMiddleware,
  upload,
  convertToJpg,
  EmployeeController.update,
);
router.delete("/:id", authMiddleware, employeesController.deleteEmployee);

export default router;
