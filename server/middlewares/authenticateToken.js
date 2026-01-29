import jwt from 'jsonwebtoken';

const authenticateToken = (req, res, next) => {
  // Получаем токен из заголовка Authorization
  const token =
    req.cookies.token || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res
      .status(403)
      .json({ message: 'Access denied. No token provided.' });
  }

  // Проверяем и декодируем токен
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Добавляем decoded (раскодированные данные из токена) в запрос
    req.user = decoded;

    // Даем доступ к следующему middleware или маршруту
    next();
  });
};

export default authenticateToken;
