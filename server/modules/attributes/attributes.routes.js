import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { AttributesController } from "./attributes.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", AttributesController.getAll);
router.get("/active", AttributesController.getActive);
router.get("/:id/values", AttributesController.getValues);
router.post("/:id/values", AttributesController.createValue);
router.put("/values/:valueId", AttributesController.updateValue);
router.delete("/values/:valueId", AttributesController.removeValue);
router.get("/:id", AttributesController.getById);
router.post("/", AttributesController.create);
router.put("/:id", AttributesController.update);
router.delete("/:id", AttributesController.remove);

export default router;
