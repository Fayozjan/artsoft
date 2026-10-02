import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { UnitsController } from "./units.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", UnitsController.getAll);
router.get("/active", UnitsController.getActive);
router.get("/:id", UnitsController.getById);
router.post("/", UnitsController.create);
router.put("/:id", UnitsController.update);
router.delete("/:id", UnitsController.remove);

export default router;
