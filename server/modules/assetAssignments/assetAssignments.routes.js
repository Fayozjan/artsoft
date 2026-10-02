import express from "express";
import multer from "multer";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { AssetAssignmentsController } from "./assetAssignments.controller.js";

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", AssetAssignmentsController.getAll);
router.get("/stats", AssetAssignmentsController.getStats);
router.get("/by-employee", AssetAssignmentsController.getByEmployee);
router.get("/suggestions", AssetAssignmentsController.getSuggestions);
router.get("/:id", AssetAssignmentsController.getById);
router.post("/import-excel", uploadExcel.single("file"), AssetAssignmentsController.importExcel);
router.post("/", AssetAssignmentsController.create);
router.put("/:id", AssetAssignmentsController.update);
router.patch("/:id/return", AssetAssignmentsController.returnAsset);
router.patch("/:id/undo-return", AssetAssignmentsController.undoReturn);
router.delete("/:id", AssetAssignmentsController.remove);

export default router;
