import express from "express";
import multer from "multer";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { FaceDevicesController } from "./faceDevices.controller.js";

const upload = multer({ dest: "tmp/" });

const router = express.Router();

router.post(
  "/events",
  upload.any(),
  tenantMiddleware,
  FaceDevicesController.receiveEvent,
);

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", tenantMiddleware, authMiddleware, FaceDevicesController.getAll);
router.get("/:id", FaceDevicesController.getById);
router.post("/", FaceDevicesController.create);
router.put("/:id", FaceDevicesController.update);

export default router;
