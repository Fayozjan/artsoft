import { Router } from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { AuditLogsController } from "./auditLogs.controller.js";

const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", AuditLogsController.list);
router.get("/entities", AuditLogsController.getEntities);

export default router;
