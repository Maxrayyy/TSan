import type { TypedIO, TypedSocket } from './index.js';
import * as roomService from '../services/roomService.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { createGame } from '../services/gameService.js';
import type { PlayerInfo } from '../game/game-engine.js';
import { notifyNextPlayer } from './gameHandler.js';

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

      // 获取房间信息
      const room = await roomService.getRoom(roomId);
      if (!room) {
        socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '房间不存在' });
        return;
      }

      // 构建玩家信息数组
      const playerInfos: PlayerInfo[] = [];
      for (let i = 0; i < 4; i++) {
        const player = room.players[i];
        if (player) {
          playerInfos.push({
            userId: player.userId,
            nickname: player.nickname,
            avatar: player.avatar,
            seatIndex: player.seatIndex,
          });
        }
      }

      // 创建游戏引擎
      const engine = createGame(roomId, playerInfos);
      const state = engine.getState();

      // 获取所有房间内的 socket
      const sockets = await io.in(roomId).fetchSockets();

      // 给每个玩家发送游戏开始事件
      for (const s of sockets) {
        const seat = s.data.seatIndex as number;
        if (seat !== undefined) {
          const playerView = engine.getPlayerView(seat);
          s.emit('game:start', { gameState: playerView });
        }
      }

      // 给当前出牌者发送出牌通知并启动计时器
      const currentSeat = state.currentPlayerSeat;
      await notifyNextPlayer(io, roomId, currentSeat);

      logger.info({ userId, roomId, players: playerInfos.map((p) => p.userId) }, '游戏开始');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      socket.emit('error', {
        code: e.code || 'INTERNAL_ERROR',
        message: e.message || '无法开始游戏',
      });
    }
  });

  socket.on('room:add-bot', async () => {
    const roomId = socket.data.roomId as string;
    if (!roomId) return;

    try {
      const { seatIndex, bot } = await roomService.addBot(roomId, userId);
      io.to(roomId).emit('room:player-joined', { player: bot, seatIndex });

      const updatedRoom = await roomService.getRoom(roomId);
      if (updatedRoom) {
        io.to(roomId).emit('room:state', updatedRoom);
      }

      logger.info({ userId, roomId, botSeat: seatIndex }, '添加机器人');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      socket.emit('error', {
        code: e.code || 'INTERNAL_ERROR',
        message: e.message || '添加机器人失败',
      });
    }
  });

  socket.on('room:kick', async (data: { seatIndex: number }) => {
    const roomId = socket.data.roomId as string;
    if (!roomId) return;

    try {
      const room = await roomService.getRoom(roomId);
      if (!room) {
        socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '房间不存在' });
        return;
      }
      if (room.hostUserId !== userId) {
        socket.emit('error', { code: 'NOT_HOST', message: '只有房主可以踢人' });
        return;
      }

      const target = room.players[data.seatIndex];
      if (!target) {
        socket.emit('error', { code: 'SEAT_EMPTY', message: '该座位没有玩家' });
        return;
      }

      if (target.isBot) {
        await roomService.removeBot(roomId, data.seatIndex);
      } else {
        await roomService.leaveRoom(roomId, target.userId);

        const sockets = await io.in(roomId).fetchSockets();
        for (const s of sockets) {
          if (s.data.userId === target.userId) {
            s.emit('room:kicked');
            s.leave(roomId);
            s.data.roomId = undefined;
            s.data.seatIndex = undefined;
            break;
          }
        }
      }

      io.to(roomId).emit('room:player-left', { playerId: target.userId });
      const updatedRoom = await roomService.getRoom(roomId);
      if (updatedRoom) {
        io.to(roomId).emit('room:state', updatedRoom);
      }

      logger.info({ userId, roomId, kickedSeat: data.seatIndex }, '踢出玩家');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      socket.emit('error', {
        code: e.code || 'INTERNAL_ERROR',
        message: e.message || '踢人失败',
      });
    }
  });

  socket.on('room:dissolve', async () => {
    const roomId = socket.data.roomId as string;
    if (!roomId) return;

    try {
      await roomService.dissolveRoom(roomId, userId);

      io.to(roomId).emit('room:dissolved');

      const sockets = await io.in(roomId).fetchSockets();
      for (const s of sockets) {
        s.leave(roomId);
        s.data.roomId = undefined;
        s.data.seatIndex = undefined;
      }

      logger.info({ userId, roomId }, '解散房间');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      socket.emit('error', {
        code: e.code || 'INTERNAL_ERROR',
        message: e.message || '解散房间失败',
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

  socket.on('disconnect', async () => {
    const roomId = socket.data.roomId as string;
    if (!roomId) return;

    try {
      const room = await roomService.getRoom(roomId);
      if (!room) return;

      if (room.hostUserId === userId) {
        await roomService.dissolveRoom(roomId, userId);
        io.to(roomId).emit('room:dissolved');
        const sockets = await io.in(roomId).fetchSockets();
        for (const s of sockets) {
          s.leave(roomId);
          s.data.roomId = undefined;
          s.data.seatIndex = undefined;
        }
      } else {
        const { dissolved } = await roomService.leaveRoom(roomId, userId);
        if (!dissolved) {
          io.to(roomId).emit('room:player-left', { playerId: userId });
          const updatedRoom = await roomService.getRoom(roomId);
          if (updatedRoom) {
            io.to(roomId).emit('room:state', updatedRoom);
          }
        }
      }
    } catch {
      // 忽略断开清理中的错误
    }
  });
}
