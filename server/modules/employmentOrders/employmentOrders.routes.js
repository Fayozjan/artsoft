import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import * as employmentOrdersController from "./employmentOrders.controller.js";

const router = Router();

// Получить список кадровых приказов
router.get("/", authMiddleware, employmentOrdersController.getEmploymentOrders);

router.get(
  "/employee/:id",
  authMiddleware,
  employmentOrdersController.getEmploymentOrdersByEmployeeId,
);

// Получить кадровый приказ по id
router.get(
  "/:id",
  authMiddleware,
  employmentOrdersController.getEmploymentOrderById,
);

// Создать кадровый приказ (hire / transfer / terminate)
router.post(
  "/",
  authMiddleware,
  employmentOrdersController.createEmploymentOrder,
);

// Обновить кадровый приказ
router.put(
  "/:id",
  authMiddleware,
  employmentOrdersController.updateEmploymentOrder,
);

// Удалить кадровый приказ
router.delete(
  "/:id",
  authMiddleware,
  employmentOrdersController.deleteEmploymentOrder,
);

export default router;
