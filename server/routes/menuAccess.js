import express from 'express';
import pool from '../db.js';
import authenticateToken from '../middlewares/authenticateToken.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    // Роль пользователя из middleware
    const userRole = req.user.role;

    // Выполняем запрос к базе данных
    const result = await pool.query(
      `SELECT menu_name, path, roles
       FROM menu_access
       WHERE is_active = TRUE`
    );

    // Фильтруем маршруты по ролям пользователя
    const accessibleMenus = result.rows.filter((menu) => {
      const roles = JSON.parse(menu.roles); // Преобразуем JSON в массив
      return roles.includes(userRole);
    });

    // Возвращаем маршруты в формате JSON
    res.json(
      accessibleMenus.map(({ menu_name, path }) => ({ menu_name, path }))
    );
  } catch (error) {
    console.error('Ошибка при загрузке доступов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
