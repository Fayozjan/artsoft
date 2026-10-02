import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { EmployeeTeamsController } from "./employeeTeams.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", EmployeeTeamsController.getByOperationType);
router.post("/", EmployeeTeamsController.create);
router.put("/:id", EmployeeTeamsController.update);
router.delete("/:id", EmployeeTeamsController.remove);

export default router;
