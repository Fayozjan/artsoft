import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { EmploymentOrdersController } from "./employmentOrders.controller.js";

const router = Router();

// Получить список кадровых приказов
router.get("/", authMiddleware, EmploymentOrdersController.getAll);

router.get(
  "/employee/:id",
  authMiddleware,
  EmploymentOrdersController.getByEmployeeId,
);

// Получить кадровый приказ по id
router.get("/:id", authMiddleware, EmploymentOrdersController.getById);

// Создать кадровый приказ
router.post("/", authMiddleware, EmploymentOrdersController.create);

// Обновить кадровый приказ
router.put("/:id", authMiddleware, EmploymentOrdersController.update);

// Удалить кадровый приказ
router.delete("/:id", authMiddleware, EmploymentOrdersController.delete);

export default router;
