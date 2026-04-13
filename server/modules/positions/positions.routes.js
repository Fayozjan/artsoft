import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { PositionsController } from "./positions.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", PositionsController.getPositions);
router.get("/active", PositionsController.getActivePositions);
router.get("/:id", PositionsController.getPositionById);
router.post("/", PositionsController.addPosition);
router.put("/:id", PositionsController.editPositionById);

export default router;
