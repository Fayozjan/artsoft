import express from "express";
import multer from "multer";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { PositionsController } from "./positions.controller.js";

const uploadExcel = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", PositionsController.getPositions);
router.get("/active", PositionsController.getActivePositions);
router.get("/:id", PositionsController.getPositionById);
router.post("/import-excel", uploadExcel.single("file"), PositionsController.importExcel);
router.post("/", PositionsController.addPosition);
router.put("/:id", PositionsController.editPositionById);

export default router;
