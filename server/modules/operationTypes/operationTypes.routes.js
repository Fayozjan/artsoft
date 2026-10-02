import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { OperationTypesController } from "./operationTypes.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", OperationTypesController.getAll);
router.get("/active", OperationTypesController.getActive);
router.get("/:id", OperationTypesController.getById);
router.post("/", OperationTypesController.create);
router.put("/:id", OperationTypesController.update);
router.delete("/:id", OperationTypesController.remove);

export default router;
