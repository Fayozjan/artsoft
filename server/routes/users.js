import express from "express";
const router = express.Router();

import * as usersController from "../controllers/usersController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

// получение всех пользователей
router.get("/", authMiddleware, usersController.getUsers);

// получить меню текущего пользователя
router.get("/menu", authMiddleware, usersController.getUserMenu);

// один пользователь по id
router.get("/:id", authMiddleware, usersController.getUserById);

// добавление пользователя
router.post("/add", authMiddleware, usersController.addUser);

// редактирование пользователя
router.put("/edit/:id", authMiddleware, usersController.editUser);

export default router;
