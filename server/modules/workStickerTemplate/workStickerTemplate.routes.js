import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { WorkStickerTemplateController } from "./workStickerTemplate.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", WorkStickerTemplateController.get);
router.get("/list", WorkStickerTemplateController.list);
router.post("/", WorkStickerTemplateController.create);
router.put("/:id", WorkStickerTemplateController.update);
router.post("/:id/activate", WorkStickerTemplateController.activate);
router.delete("/:id", WorkStickerTemplateController.remove);

export default router;
