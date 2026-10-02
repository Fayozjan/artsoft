import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { StockPickingTypesController } from "./stockPickingTypes.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", StockPickingTypesController.getAll);
router.get("/active", StockPickingTypesController.getActive);
router.get("/codes", StockPickingTypesController.getCodes);
router.get("/:id", StockPickingTypesController.getById);
router.post("/", StockPickingTypesController.create);
router.put("/:id", StockPickingTypesController.update);
router.delete("/:id", StockPickingTypesController.remove);

export default router;
