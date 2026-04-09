import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { ClientToServerEvents, ServerToClientEvents } from '@tuosan/shared';
import { verifyAccessToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { registerRoomHandlers } from './roomHandler.js';
import { registerGameHandlers } from './gameHandler.js';

export type TypedIO = Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Parameters<Parameters<TypedIO['on']>[1]>[0];

export function initSocketIO(httpServer: HttpServer): TypedIO {
  const io: TypedIO = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) {
      return next(new Error('UNAUTHORIZED'));
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      socket.data.isGuest = payload.isGuest;
      next();
    } catch {
      next(new Error('TOKEN_EXPIRED'));
    }
  });

  io.on('connection', (socket) => {
    logger.debug({ userId: socket.data.userId }, 'Socket connected');

    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);

    socket.on('disconnect', () => {
      logger.debug({ userId: socket.data.userId }, 'Socket disconnected');
    });
  });

  return io;
}
