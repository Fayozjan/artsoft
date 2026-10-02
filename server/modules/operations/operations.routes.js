import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { OperationsController } from "./operations.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", OperationsController.getAll);
router.get("/:id", OperationsController.getById);
router.post("/", OperationsController.create);
router.put("/:id", OperationsController.update);
router.post("/:id/accept", OperationsController.accept);
router.post("/:id/revert", OperationsController.revert);
router.delete("/:id", OperationsController.remove);

export default router;
