import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import * as branchesController from "./branches.controller.js";

const router = Router();

router.get("/", authMiddleware, branchesController.getBranches);
router.get(
  "/active",
  authMiddleware,
  branchesController.getActiveBranchesController,
);
router.get("/:id", authMiddleware, branchesController.getBranchById);
router.post("/", authMiddleware, branchesController.createBranch);
router.put("/:id", authMiddleware, branchesController.updateBranch);
router.delete("/:id", authMiddleware, branchesController.deleteBranchById);
router.get("/check/:id", authMiddleware, branchesController.checkBranchUsage);

export default router;
