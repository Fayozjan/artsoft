import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { getAttendance } from "./attendance.controller.js";

const router = express.Router();

router.get("/", authMiddleware, getAttendance);

export default router;
