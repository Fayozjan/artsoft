import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { getLateEmployees } from "./lateEmployees.controller.js";

const router = express.Router();

router.get("/", authMiddleware, getLateEmployees);
// router.post("/by-employees", getLateEmployeesByUsers);

export default router;
