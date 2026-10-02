import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { CronTasksController } from "./cronTasks.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", CronTasksController.getAll);
router.get("/:id", CronTasksController.getOne);
router.post("/", CronTasksController.create);
router.put("/:id", CronTasksController.update);
router.patch("/:id/toggle", CronTasksController.toggle);
router.delete("/:id", CronTasksController.remove);
router.post("/:id/run-now", CronTasksController.runNow);

export default router;
