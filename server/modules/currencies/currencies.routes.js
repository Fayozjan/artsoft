import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { CurrenciesController } from "./currencies.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", CurrenciesController.getAll);
router.get("/active", CurrenciesController.getActive);
router.get("/:id/rate", CurrenciesController.getRate);
router.get("/:id", CurrenciesController.getById);
router.post("/", CurrenciesController.create);
router.put("/:id", CurrenciesController.update);
router.delete("/:id", CurrenciesController.remove);

export default router;
