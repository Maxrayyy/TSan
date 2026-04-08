import { Router, type Response, type NextFunction } from 'express';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import * as roomService from '../services/roomService.js';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';

const router = Router();

router.post(
  '/api/room/create',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { id: true, nickname: true, avatar: true },
      });
      if (!user) throw new AppError(401, '用户不存在', 'UNAUTHORIZED');

      const { roomId } = await roomService.createRoom(user.id, user.nickname, user.avatar);
      res.json({ success: true, data: { roomId } });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/api/room/:roomId', async (req, res, next) => {
  try {
    const room = await roomService.getRoom(req.params.roomId);
    if (!room) {
      throw new AppError(404, '房间不存在', 'ROOM_NOT_FOUND');
    }
    const playerCount = Object.values(room.players).filter(Boolean).length;
    res.json({ success: true, data: { ...room, playerCount } });
  } catch (err) {
    next(err);
  }
});

export default router;
