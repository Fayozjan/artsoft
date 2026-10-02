import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { DoorsController } from "./doors.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", DoorsController.getAll);
router.get("/active", DoorsController.getActive);
router.post("/sync-all", DoorsController.syncAll);
router.get("/:id", DoorsController.getById);
router.post("/", DoorsController.create);
router.put("/:id", DoorsController.update);
router.delete("/:id", DoorsController.remove);
router.post("/:id/sync", DoorsController.syncOne);

export default router;
