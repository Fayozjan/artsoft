import express from 'express';
import pool from '../db.js';
const router = express.Router();
import bcrypt from 'bcrypt';

router.post('/', async (req, res) => {
  const { user_id, currentPassword, newPassword } = req.body;

  if (!user_id || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }

  try {
    const userQuery = 'SELECT password FROM logins WHERE user_id = $1';
    const userResult = await pool.query(userQuery, [user_id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const storedPasswordHash = userResult.rows[0].password;

    // Проверяем совпадение текущего пароля
    const isMatch = await bcrypt.compare(currentPassword, storedPasswordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Неверный текущий пароль' });
    }

    // Хешируем новый пароль
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Обновляем пароль в базе данных
    const updateQuery = 'UPDATE logins SET password = $1 WHERE user_id = $2';
    await pool.query(updateQuery, [newPasswordHash, user_id]);

    res.json({ message: 'Пароль успешно изменен' });
  } catch (err) {
    console.error('Ошибка изменения пароля:', err);
    res.status(500).json({ error: 'Произошла ошибка сервера' });
  }
});

export default router;
