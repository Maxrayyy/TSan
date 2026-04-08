import { create } from 'zustand';
import type { RoomState, RoomPlayer } from '@tuosan/shared';
import { getSocket, type TypedSocket } from '../services/socket.js';

interface ChatMessage {
  playerId: string;
  nickname: string;
  message: string;
  timestamp: number;
}

interface RoomStore {
  room: RoomState | null;
  socket: TypedSocket | null;
  chatMessages: ChatMessage[];
  error: string | null;

  joinRoom: (roomId: string, seatIndex?: number) => void;
  leaveRoom: () => void;
  toggleReady: () => void;
  startGame: () => void;
  sendChat: (message: string) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  room: null,
  socket: null,
  chatMessages: [],
  error: null,

  joinRoom: (roomId: string, seatIndex?: number) => {
    try {
      const socket = getSocket();
      set({ socket, error: null });

      // Register listeners
      socket.on('room:state', (data: RoomState) => {
        set({ room: data });
      });

      socket.on('room:player-joined', (data: { player: RoomPlayer; seatIndex: number }) => {
        const room = get().room;
        if (!room) return;
        const updatedPlayers = { ...room.players, [data.seatIndex]: data.player };
        set({ room: { ...room, players: updatedPlayers } });
      });

      socket.on('room:player-left', () => {
        // Will receive room:state with updated data
      });

      socket.on('room:player-ready', (data: { playerId: string; isReady: boolean }) => {
        const room = get().room;
        if (!room) return;
        const updatedPlayers = { ...room.players };
        for (const key of Object.keys(updatedPlayers)) {
          const p = updatedPlayers[Number(key)];
          if (p?.userId === data.playerId) {
            updatedPlayers[Number(key)] = { ...p, isReady: data.isReady };
          }
        }
        set({ room: { ...room, players: updatedPlayers } });
      });

      socket.on('room:chat', (data: ChatMessage) => {
        set((state) => ({ chatMessages: [...state.chatMessages, data] }));
      });

      socket.on('error', (data: { code: string; message: string }) => {
        set({ error: data.message });
      });

      // Emit join
      socket.emit('room:join', { roomId, seatIndex });
    } catch {
      set({ error: '连接服务器失败' });
    }
  },

  leaveRoom: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('room:leave');
      socket.removeAllListeners();
    }
    set({ room: null, socket: null, chatMessages: [], error: null });
  },

  toggleReady: () => {
    get().socket?.emit('room:ready');
  },

  startGame: () => {
    get().socket?.emit('room:start');
  },

  sendChat: (message: string) => {
    get().socket?.emit('room:chat', { message });
  },

  reset: () => {
    const { socket } = get();
    if (socket) socket.removeAllListeners();
    set({ room: null, socket: null, chatMessages: [], error: null });
  },
}));
