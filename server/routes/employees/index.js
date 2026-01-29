import express from 'express';
const router = express.Router();

// Подключаем отдельные маршруты для пользователей
import deleteUser from './delete.js';
import updateUser from './update.js';
import getUser from './get.js';
import createUser from './create.js';

// Маршруты пользователей
router.use('/delete', deleteUser);
router.use('/update', updateUser);
router.use('/get', getUser);
router.use('/create', createUser);

export default router;
