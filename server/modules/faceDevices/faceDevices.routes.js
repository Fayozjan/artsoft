import express from "express";
import multer from "multer";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { faceEventDump } from "../../middlewares/faceEventDump.js";
import { FaceDevicesController } from "./faceDevices.controller.js";

const upload = multer({ dest: "tmp/" });

const router = express.Router();

// faceEventDump стоит до tenantMiddleware: иначе события с неверным Host
// (устройство шлёт на IP → "Tenant not found") пропадали бы без следа.
router.post(
  "/events",
  upload.any(),
  faceEventDump,
  tenantMiddleware,
  FaceDevicesController.receiveEvent,
);

// Тот же обработчик, но устройство задано явно в URL. Часть прошивок не шлёт
// ни MAC, ни стабильный IP — тогда это единственный надёжный способ опознания.
router.post(
  "/events/:deviceId",
  upload.any(),
  faceEventDump,
  tenantMiddleware,
  FaceDevicesController.receiveEvent,
);

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", tenantMiddleware, authMiddleware, FaceDevicesController.getAll);
router.get("/online-status", FaceDevicesController.getOnlineStatus);
router.get("/capacity", FaceDevicesController.getCapacity);
router.get("/:id", FaceDevicesController.getById);
router.post("/", FaceDevicesController.create);
router.post("/sync-time", FaceDevicesController.syncTime);
router.put("/:id", FaceDevicesController.update);
router.delete("/:id", FaceDevicesController.remove);

export default router;
