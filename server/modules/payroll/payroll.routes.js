import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { PayrollController } from "./payroll.controller.js";

const router = Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", PayrollController.getOrGenerate);
router.get("/advances", PayrollController.getAdvances);
router.post("/advances", PayrollController.createAdvances);
router.put("/advances/:id", PayrollController.updateAdvance);
router.delete("/advances/:id", PayrollController.deleteAdvance);
router.get("/payouts", PayrollController.getPayouts);
router.put("/payouts/bulk-status", PayrollController.bulkMarkPaid);
router.put("/items/bulk-status", PayrollController.bulkUpdateStatus);
router.get("/items/:itemId/payments", PayrollController.getPaymentLogs);
router.post("/items/:itemId/payments", PayrollController.addPaymentLog);
router.delete("/items/:itemId/payments/:logId", PayrollController.deletePaymentLog);
router.put("/items/:itemId", PayrollController.updateItem);
router.put("/:id/all-status", PayrollController.updateAllItemsStatus);
router.put("/:id/bulk-apply", PayrollController.bulkApplyFlags);
router.put("/:id/payouts-all-status", PayrollController.markAllPayoutsStatus);
router.put("/:id/recalculate-balances", PayrollController.recalculateSalaryBalances);
router.post("/:id/approve", PayrollController.approveSheet);
router.delete("/:id", PayrollController.deleteSheet);

export default router;
