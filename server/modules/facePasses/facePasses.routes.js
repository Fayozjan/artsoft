import { Router } from "express";
import multer from "multer";
import {
  authMiddleware,
  authPhotoMiddleware,
} from "../../middlewares/authMiddleware.js";
import { FacePassesController } from "./facePasses.controller.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";

const upload = multer({ dest: "tmp/" });

const router = Router();

router.get(
  "/image/*",
  tenantMiddleware,
  authPhotoMiddleware,
  FacePassesController.getImage,
);

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", FacePassesController.get);
router.post("/", upload.any(), FacePassesController.create);
router.get("/:id", FacePassesController.getById);
router.put("/:id", FacePassesController.updateById);
router.delete("/:id", FacePassesController.deleteById);

export default router;
