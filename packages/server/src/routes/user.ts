import { Router, type Response, type NextFunction } from 'express';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { prisma } from '../config/database.js';

const router = Router();

router.get(
  '/api/user/profile',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { id: true, nickname: true, avatar: true, isGuest: true, createdAt: true },
      });
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/api/user/profile',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { nickname, avatar } = req.body;
      const data: Record<string, string> = {};
      if (nickname) data.nickname = nickname;
      if (avatar) data.avatar = avatar;

      const user = await prisma.user.update({
        where: { id: req.user!.userId },
        data,
        select: { id: true, nickname: true, avatar: true },
      });
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/api/user/stats',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await prisma.userStats.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!stats) {
        res.json({ success: true, data: null });
        return;
      }
      const { id, userId, ...rest } = stats;
      void id;
      void userId;
      const winRate = rest.totalGames > 0 ? rest.totalWins / rest.totalGames : 0;
      res.json({ success: true, data: { ...rest, winRate } });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
