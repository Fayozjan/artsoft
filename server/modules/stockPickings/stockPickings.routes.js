import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { StockPickingsController } from "./stockPickings.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", StockPickingsController.getAll);
router.get("/origins", StockPickingsController.getOrigins);
router.get("/stock-balance", StockPickingsController.getStockBalance);
router.get("/:id", StockPickingsController.getById);
router.post("/", StockPickingsController.create);
router.put("/:id", StockPickingsController.update);
router.post("/:id/confirm", StockPickingsController.confirm);
router.post("/:id/validate", StockPickingsController.validate);
router.post("/:id/cancel", StockPickingsController.cancel);
router.delete("/:id", StockPickingsController.remove);

export default router;
