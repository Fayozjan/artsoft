import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { ProductsController } from "./products.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", ProductsController.getAll);
router.get("/active", ProductsController.getActive);
router.get("/:id", ProductsController.getById);
router.post("/", ProductsController.create);
router.put("/:id", ProductsController.update);
router.delete("/:id", ProductsController.remove);

export default router;
