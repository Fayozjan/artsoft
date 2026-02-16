import { Router } from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import uploadPhoto from "../../middlewares/uploadPhoto.js";

import { EmployeeController } from "./employees.controller.js";

const router = Router();
const { upload, convertToJpg } = uploadPhoto("employees");

router.get("/", authMiddleware, EmployeeController.getAll);
router.get("/active", authMiddleware, EmployeeController.getActive);
router.get("/:id", authMiddleware, EmployeeController.getById);
router.post(
  "/",
  authMiddleware,
  upload,
  convertToJpg,
  EmployeeController.create,
);
router.put(
  "/:id",
  authMiddleware,
  upload,
  convertToJpg,
  EmployeeController.update,
);
router.delete("/:id", authMiddleware, EmployeeController.delete);

export default router;
