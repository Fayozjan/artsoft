import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { ProductionReportController } from "./productionReport.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/batches", ProductionReportController.getByBatch);
router.get("/employees", ProductionReportController.getByEmployee);
router.get("/operations", ProductionReportController.getByOperation);
router.get("/orders", ProductionReportController.getByOrder);
router.get("/monitoring", ProductionReportController.getMonitoring);
router.get("/stickers", ProductionReportController.getStickers);
router.get("/stickers/item-attributes", ProductionReportController.getStickerItemAttributes);
router.put("/stickers/rate", ProductionReportController.updateStickerRates);
router.get("/stickers/:id/chronology", ProductionReportController.getStickerChronology);

export default router;
