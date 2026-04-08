import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@tuosan/shared';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (socket?.connected) return socket;

  const token = localStorage.getItem('accessToken');
  if (!token) throw new Error('未登录');

  socket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  }) as TypedSocket;

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
