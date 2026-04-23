import { Router } from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import {
  authMiddleware,
  authPhotoMiddleware,
} from "../../middlewares/authMiddleware.js";

import uploadPhoto from "../../middlewares/uploadPhoto.js";
import { EmployeeController } from "./employees.controller.js";

const router = Router();
const { upload, convertToJpg } = uploadPhoto("employees");

router.use(tenantMiddleware);

router.get("/image/*", authPhotoMiddleware, EmployeeController.getImage);
router.get("/image-link/*", EmployeeController.getImageTempLink);
router.get("/photo/:token", EmployeeController.getImageByToken);

router.use(authMiddleware);

router.get("/", tenantMiddleware, authMiddleware, EmployeeController.getAll);
router.get("/active", EmployeeController.getActive);
router.get("/stats", EmployeeController.getStats);
router.get("/:id", EmployeeController.getById);
router.post("/", upload, convertToJpg, EmployeeController.create);
router.put("/:id", upload, convertToJpg, EmployeeController.update);
router.delete("/:id", EmployeeController.delete);

export default router;
