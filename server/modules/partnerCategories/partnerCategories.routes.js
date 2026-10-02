import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { PartnerCategoriesController } from "./partnerCategories.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", PartnerCategoriesController.getAll);
router.get("/active", PartnerCategoriesController.getActive);
router.get("/:id", PartnerCategoriesController.getById);
router.post("/", PartnerCategoriesController.create);
router.put("/:id", PartnerCategoriesController.update);
router.delete("/:id", PartnerCategoriesController.remove);

export default router;
