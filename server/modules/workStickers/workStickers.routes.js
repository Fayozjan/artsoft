import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { WorkStickersController } from "./workStickers.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", WorkStickersController.getAll);
router.get("/by-code/:code", WorkStickersController.getByCode);
router.get("/item/:itemId/remaining", WorkStickersController.getItemRemaining);
router.get("/:id", WorkStickersController.getById);
router.post("/", WorkStickersController.create);
router.post("/by-code/:code/scan", WorkStickersController.scan);
router.post("/by-code/:code/advance", WorkStickersController.advance);
router.post("/merge", WorkStickersController.merge);
router.post("/by-code/:code/awaiting-merge", WorkStickersController.setAwaitingMerge);
router.post("/by-code/:code/revert", WorkStickersController.revert);
router.delete("/:id", WorkStickersController.remove);

export default router;
