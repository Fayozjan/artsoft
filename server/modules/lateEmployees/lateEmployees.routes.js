import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { getLateEmployees } from "./lateEmployees.controller.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", getLateEmployees);
// router.post("/by-employees", getLateEmployeesByUsers);

export default router;
