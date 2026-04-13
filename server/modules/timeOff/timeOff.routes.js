import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { TimeOffController } from "./timeOff.controller.js";

const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", TimeOffController.get);
router.get("/:id", TimeOffController.getById);
router.post("/", TimeOffController.create);
router.put("/:id", TimeOffController.updateById);
router.delete("/:id", TimeOffController.deleteById);

export default router;
