import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { StockLocationsController } from "./stockLocations.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", StockLocationsController.getAll);
router.get("/active", StockLocationsController.getActive);
router.get("/types", StockLocationsController.getTypes);
router.get("/:id", StockLocationsController.getById);
router.post("/", StockLocationsController.create);
router.put("/:id", StockLocationsController.update);
router.delete("/:id", StockLocationsController.remove);

export default router;
