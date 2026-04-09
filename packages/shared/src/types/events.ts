import type { Card, HandType } from './card.js';
import type { ClientGameState, GameResult } from './game.js';
import type { RoomPlayer, RoomState } from './room.js';

// 客户端 → 服务端
export interface ClientToServerEvents {
  'room:join': (data: { roomId: string; seatIndex?: number }) => void;
  'room:leave': () => void;
  'room:ready': () => void;
  'room:start': () => void;
  'room:chat': (data: { message: string }) => void;
  'game:play': (data: { cards: Card[] }) => void;
  'game:pass': () => void;
  'game:reconnect-request': () => void;
  'room:add-bot': () => void;
  'room:kick': (data: { seatIndex: number }) => void;
  'room:dissolve': () => void;
}

// 服务端 → 客户端
export interface ServerToClientEvents {
  'room:state': (data: RoomState) => void;
  'room:player-joined': (data: { player: RoomPlayer; seatIndex: number }) => void;
  'room:player-left': (data: { playerId: string }) => void;
  'room:player-ready': (data: { playerId: string; isReady: boolean }) => void;
  'room:chat': (data: {
    playerId: string;
    nickname: string;
    message: string;
    timestamp: number;
  }) => void;
  'game:start': (data: { gameState: ClientGameState }) => void;
  'game:your-turn': (data: { timeLimit: number }) => void;
  'game:played': (data: {
    playerId: string;
    seatIndex: number;
    cards: Card[];
    handType: HandType;
    remainingCards: number;
    nextSeat: number;
  }) => void;
  'game:passed': (data: { playerId: string; seatIndex: number; nextSeat: number }) => void;
  'game:round-end': (data: { winnerId: string; winnerSeat: number; score: number }) => void;
  'game:tuo-san': (data: { playerId: string; seatIndex: number; count: number }) => void;
  'game:bie-san': (data: { playerId: string; seatIndex: number; count: number }) => void;
  'game:player-finished': (data: { playerId: string; seatIndex: number; rank: number }) => void;
  'game:end': (data: { result: GameResult }) => void;
  'game:reconnect': (data: { gameState: ClientGameState }) => void;
  'game:player-disconnected': (data: { seatIndex: number }) => void;
  'game:player-reconnected': (data: { seatIndex: number }) => void;
  'room:kicked': () => void;
  'room:dissolved': () => void;
  error: (data: { code: string; message: string }) => void;
}
