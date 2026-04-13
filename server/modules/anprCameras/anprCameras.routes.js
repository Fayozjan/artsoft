import express from "express";
import multer from "multer";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { AnprCamerasController } from "./anprCameras.controller.js";

const upload = multer({ dest: "tmp/" });

const router = express.Router();

router.post(
  "/events",
  upload.any(),
  tenantMiddleware,
  AnprCamerasController.receiveEvent,
);

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", tenantMiddleware, authMiddleware, AnprCamerasController.getAll);
router.get("/:id", AnprCamerasController.getById);
router.post("/", AnprCamerasController.create);
router.put("/:id", AnprCamerasController.update);

export default router;
