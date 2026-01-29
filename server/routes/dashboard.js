import express from 'express';
import authenticateToken from '../middlewares/authenticateToken.js';

const router = express.Router();

router.get('/dashboard', authenticateToken, (req, res) => {
  res.status(200).json({ message: 'Welcome to your profile', user: req.user });
});

export default router;
