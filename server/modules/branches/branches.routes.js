import { Router } from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { BranchController } from "./branches.controller.js";

const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", BranchController.list);
router.get("/active", BranchController.listActive);
router.get("/:id/in-use", BranchController.isInUse);
router.get("/:id", BranchController.getById);
router.post("/", BranchController.create);
router.put("/:id", BranchController.update);
router.delete("/:id", BranchController.remove);

export default router;
