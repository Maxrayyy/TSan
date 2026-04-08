import { Router } from 'express';
import * as authService from '../services/authService.js';

const router = Router();

router.post('/api/auth/guest', async (req, res, next) => {
  try {
    const { nickname } = req.body;
    const data = await authService.guestLogin(nickname);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/api/auth/register', async (req, res, next) => {
  try {
    const { nickname, email, password } = req.body;
    const data = await authService.register(nickname, email, password);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const data = await authService.login(email, password);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/api/auth/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const data = await authService.refreshToken(refreshToken);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
