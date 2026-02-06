import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { BranchController } from "./branches.controller.js";

const router = Router();

router.get("/", authMiddleware, BranchController.list);
router.get("/active", authMiddleware, BranchController.listActive);
router.get("/:id/in-use", authMiddleware, BranchController.isInUse);
router.get("/:id", authMiddleware, BranchController.getById);

router.post("/", authMiddleware, BranchController.create);
router.put("/:id", authMiddleware, BranchController.update);
router.delete("/:id", authMiddleware, BranchController.remove);

export default router;
