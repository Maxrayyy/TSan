import type { TypedIO, TypedSocket } from './index.js';
import * as roomService from '../services/roomService.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

export function registerRoomHandlers(io: TypedIO, socket: TypedSocket) {
  const userId = socket.data.userId as string;

  socket.on('room:join', async (data: { roomId: string; seatIndex?: number }) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, nickname: true, avatar: true },
      });
      if (!user) {
        socket.emit('error', { code: 'UNAUTHORIZED', message: '用户不存在' });
        return;
      }

      const { seatIndex, room } = await roomService.joinRoom(
        data.roomId,
        user.id,
        user.nickname,
        user.avatar,
        data.seatIndex,
      );

      // Join socket room
      await socket.join(data.roomId);
      socket.data.roomId = data.roomId;
      socket.data.seatIndex = seatIndex;

      // Send full state to the joining player
      socket.emit('room:state', room);

      // Broadcast to others
      socket.to(data.roomId).emit('room:player-joined', {
        player: room.players[seatIndex]!,
        seatIndex,
      });

      logger.info({ userId, roomId: data.roomId, seatIndex }, 'Player joined room');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      socket.emit('error', {
        code: e.code || 'INTERNAL_ERROR',
        message: e.message || '加入房间失败',
      });
    }
  });

  socket.on('room:leave', async () => {
    const roomId = socket.data.roomId as string;
    if (!roomId) return;

    try {
      const { seatIndex, dissolved } = await roomService.leaveRoom(roomId, userId);
      await socket.leave(roomId);
      socket.data.roomId = undefined;
      socket.data.seatIndex = undefined;

      if (!dissolved && seatIndex >= 0) {
        // Notify others and send updated room state
        io.to(roomId).emit('room:player-left', { playerId: userId });
        const updatedRoom = await roomService.getRoom(roomId);
        if (updatedRoom) {
          io.to(roomId).emit('room:state', updatedRoom);
        }
      }

      logger.info({ userId, roomId, dissolved }, 'Player left room');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      socket.emit('error', {
        code: e.code || 'INTERNAL_ERROR',
        message: e.message || '离开房间失败',
      });
    }
  });

  socket.on('room:ready', async () => {
    const roomId = socket.data.roomId as string;
    if (!roomId) return;

    try {
      const { seatIndex, isReady } = await roomService.setReady(roomId, userId);
      io.to(roomId).emit('room:player-ready', { playerId: userId, isReady });

      logger.debug({ userId, roomId, seatIndex, isReady }, 'Player ready toggled');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      socket.emit('error', {
        code: e.code || 'INTERNAL_ERROR',
        message: e.message || '操作失败',
      });
    }
  });

  socket.on('room:start', async () => {
    const roomId = socket.data.roomId as string;
    if (!roomId) return;

    try {
      await roomService.canStartGame(roomId, userId);
      await roomService.setRoomStatus(roomId, 'playing');

      // TODO: Phase 2 - Create GameEngine and broadcast game:start
      logger.info({ userId, roomId }, 'Game starting (engine not yet implemented)');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      socket.emit('error', {
        code: e.code || 'INTERNAL_ERROR',
        message: e.message || '无法开始游戏',
      });
    }
  });

  socket.on('room:chat', (data: { message: string }) => {
    const roomId = socket.data.roomId as string;
    if (!roomId) return;

    const message = data.message?.slice(0, 200);
    if (!message) return;

    io.to(roomId).emit('room:chat', {
      playerId: userId,
      nickname: '',
      message,
      timestamp: Date.now(),
    });
  });

  // Handle disconnect - auto leave room
  socket.on('disconnect', async () => {
    const roomId = socket.data.roomId as string;
    if (!roomId) return;

    try {
      const { dissolved } = await roomService.leaveRoom(roomId, userId);
      if (!dissolved) {
        io.to(roomId).emit('room:player-left', { playerId: userId });
        const updatedRoom = await roomService.getRoom(roomId);
        if (updatedRoom) {
          io.to(roomId).emit('room:state', updatedRoom);
        }
      }
    } catch {
      // Ignore errors during disconnect cleanup
    }
  });
}
