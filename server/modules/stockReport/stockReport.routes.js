import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { StockReportController } from "./stockReport.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/balances", StockReportController.getBalances);
router.get("/balances/lots", StockReportController.getBalanceLots);
router.get("/movements", StockReportController.getMovements);
router.get("/turnover", StockReportController.getTurnover);
router.get("/turnover/lots", StockReportController.getTurnoverLots);

export default router;
