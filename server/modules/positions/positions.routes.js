import express from "express";
import * as positionsContollers from "./positions.controller.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, positionsContollers.getPositions);
router.get("/active", authMiddleware, positionsContollers.getActivePositions);
router.get("/:id", authMiddleware, positionsContollers.getPositionById);
router.post("/", authMiddleware, positionsContollers.addPosition);
router.put("/:id", authMiddleware, positionsContollers.editPositionById);

export default router;
