import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import * as faceDevicesController from "./faceDevices.controller.js";

const router = express.Router();

router.get("/", authMiddleware, faceDevicesController.getAll);
router.get("/:id", authMiddleware, faceDevicesController.getById);
router.post("/", authMiddleware, faceDevicesController.create);
router.put("/:id", authMiddleware, faceDevicesController.update);

export default router;
