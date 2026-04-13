import express from "express";
import { tenantMiddleware } from "../../middlewares/tenantMiddleware.js";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { UserController } from "./users.controller.js";

const router = express.Router();

router.use(tenantMiddleware);
router.use(authMiddleware);

router.get("/", UserController.get);
router.put("/me", UserController.updateProfile);
router.get("/me", UserController.getInfo);
router.get("/me/access", UserController.getAccess);
router.get("/menu", UserController.getMenu);
router.get("/:id", UserController.getById);
router.post("/", UserController.create);
router.put("/:id", UserController.updateById);

export default router;
