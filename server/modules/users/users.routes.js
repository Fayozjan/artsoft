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
// до "/:id", иначе "lockouts" уедет в параметр
router.get("/lockouts", UserController.getLockouts);
router.post("/:id/unlock", UserController.unlockLogin);
router.get("/:id", UserController.getById);
router.post("/", UserController.create);
router.put("/:id", UserController.updateById);

export default router;
