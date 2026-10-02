import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { CanteenController } from "./canteen.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/allowances", CanteenController.getAllowances);
router.get("/allowances/stats", CanteenController.getAllowanceStats);
router.get("/allowances/:id", CanteenController.getAllowanceById);
router.post("/allowances", CanteenController.assignAllowances);
router.put("/allowances/:id", CanteenController.updateAllowance);
router.delete("/allowances/:id", CanteenController.deleteAllowance);

router.get("/display", CanteenController.getDisplayState);
router.get("/devices", CanteenController.getDevices);
router.get("/meals", CanteenController.getMeals);
router.post("/meals/bulk-delete", CanteenController.bulkDeleteMeals);
router.delete("/meals/:id", CanteenController.deleteMeal);
router.get("/report", CanteenController.getReport);

export default router;
