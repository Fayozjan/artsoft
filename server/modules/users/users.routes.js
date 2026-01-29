import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import * as usersController from "./users.controller.js";
import { UserController } from "./users.controller.js";

const router = express.Router();

router.get("/", authMiddleware, usersController.getUsers);
router.put("/me", authMiddleware, usersController.editUser);
router.get("/me", authMiddleware, usersController.getUserInfo);
router.get("/menu", authMiddleware, UserController.getUserMenu);
router.get("/:id", authMiddleware, UserController.getUserById);
router.post("/", authMiddleware, usersController.addUser);
router.put("/:id", authMiddleware, usersController.editUserById);

export default router;
