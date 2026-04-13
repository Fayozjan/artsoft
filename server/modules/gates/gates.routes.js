import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { GatesController } from "./gates.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", GatesController.getAll);
router.get("/active", GatesController.getActive);
router.get("/:id", GatesController.getById);
router.post("/", GatesController.create);
router.put("/:id", GatesController.update);

export default router;
