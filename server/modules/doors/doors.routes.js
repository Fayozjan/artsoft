import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import * as doorsController from "./doors.controller.js";

const router = express.Router();

router.get("/", authMiddleware, doorsController.getAll);
router.get("/active", authMiddleware, doorsController.getActive);
router.get("/:id", authMiddleware, doorsController.getById);
router.post("/", authMiddleware, doorsController.create);
router.put("/:id", authMiddleware, doorsController.update);

export default router;
