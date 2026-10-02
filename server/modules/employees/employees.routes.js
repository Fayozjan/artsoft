import { Router } from "express";
import multer from "multer";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import {
  authMiddleware,
  authPhotoMiddleware,
} from "../../middlewares/authMiddleware.js";

import uploadPhoto from "../../middlewares/uploadPhoto.js";
import { EmployeeController } from "./employees.controller.js";

const uploadExcel = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
router.get("/rehire-candidates", EmployeeController.getRehireCandidates);
router.get("/rehire-candidates/:id", EmployeeController.getRehireCandidate);
router.get("/:id/delete-impact", EmployeeController.getDeleteImpact);
router.get("/:id/profile", EmployeeController.getProfile);
router.get("/:id", EmployeeController.getById);
router.post("/import-excel", uploadExcel.single("file"), EmployeeController.importExcel);
router.post("/", upload, convertToJpg, EmployeeController.create);
router.put("/bulk/work-schedule", EmployeeController.bulkUpdateWorkSchedule);
router.put("/bulk/doors", EmployeeController.bulkUpdateDoors);
router.put("/bulk/placement", EmployeeController.bulkUpdatePlacement);
router.post("/bulk/delete-impact", EmployeeController.getBulkDeleteImpact);
router.post("/bulk/delete", EmployeeController.bulkDelete);
router.post("/bulk/sync-face", EmployeeController.bulkSyncFaceDevices);
router.post("/:id/rehire", upload, convertToJpg, EmployeeController.rehire);
router.put("/:id", upload, convertToJpg, EmployeeController.update);
router.delete("/:id", EmployeeController.delete);

export default router;
