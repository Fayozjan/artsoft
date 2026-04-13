import { Router } from "express";
import {
  authMiddleware,
  authPhotoMiddleware,
} from "../../middlewares/authMiddleware.js";
import { VehiclePassesController } from "./vehiclePasses.controller.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";

const router = Router();

router.get(
  "/image/*",
  tenantMiddleware,
  authPhotoMiddleware,
  VehiclePassesController.getImage,
);

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", VehiclePassesController.get);

router.get("/:id", VehiclePassesController.getById);
router.put("/:id", VehiclePassesController.updateById);
router.delete("/:id", VehiclePassesController.deleteById);

export default router;
