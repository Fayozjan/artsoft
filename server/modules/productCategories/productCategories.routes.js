import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { ProductCategoriesController } from "./productCategories.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", ProductCategoriesController.getAll);
router.get("/active", ProductCategoriesController.getActive);
router.get("/:id", ProductCategoriesController.getById);
router.post("/", ProductCategoriesController.create);
router.put("/:id", ProductCategoriesController.update);
router.delete("/:id", ProductCategoriesController.remove);

export default router;
