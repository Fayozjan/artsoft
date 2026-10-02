import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { PartnersController } from "./partners.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", PartnersController.getAll);
router.get("/active", PartnersController.getActive);
router.get("/:id", PartnersController.getById);
router.post("/", PartnersController.create);
router.put("/:id", PartnersController.update);
router.delete("/:id", PartnersController.remove);

export default router;
