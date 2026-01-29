import express from 'express';
const router = express.Router();

router.post('/', (req, res) => {
  // Здесь можно выполнить логику удаления токена или аннулирования сессии.
  res.clearCookie('authToken'); // Если кука используется на сервере
  res.status(200).json({ message: 'Вы успешно вышли из системы' });
});

export default router;
