import express from "express";
import { EmployeeSalaryHistoryController } from "./employeeSalaryHistory.controller.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/employees", EmployeeSalaryHistoryController.getEmployeesWithSalary);
router.get("/", EmployeeSalaryHistoryController.getByEmployee);
router.post("/", EmployeeSalaryHistoryController.create);
router.put("/:id", EmployeeSalaryHistoryController.update);
router.delete("/:id", EmployeeSalaryHistoryController.deleteById);

export default router;
