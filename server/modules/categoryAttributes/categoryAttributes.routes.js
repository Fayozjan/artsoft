import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { CategoryAttributesController } from "./categoryAttributes.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", CategoryAttributesController.getAll);
router.post("/", CategoryAttributesController.create);
router.put("/:id", CategoryAttributesController.update);
router.delete("/:id", CategoryAttributesController.remove);

export default router;
