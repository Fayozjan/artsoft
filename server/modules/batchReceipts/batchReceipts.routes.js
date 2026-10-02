import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { BatchReceiptsController } from "./batchReceipts.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", BatchReceiptsController.getAll);
router.get("/stats", BatchReceiptsController.getStats);
router.get("/:id", BatchReceiptsController.getById);
router.post("/", BatchReceiptsController.create);
router.put("/:id", BatchReceiptsController.update);
router.post("/:id/items", BatchReceiptsController.appendItems);
router.delete("/:id/items/:itemId", BatchReceiptsController.removeItem);
router.post("/:id/accept",BatchReceiptsController.accept);
router.post("/:id/revert", BatchReceiptsController.revert);
router.delete("/:id", BatchReceiptsController.remove);

export default router;
