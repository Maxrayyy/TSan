export interface RoomPlayer {
  userId: string;
  nickname: string;
  avatar: string;
  seatIndex: number;
  isReady: boolean;
  isHost: boolean;
  isBot: boolean;
}

export interface RoomState {
  roomId: string;
  hostUserId: string;
  players: Record<number, RoomPlayer | null>;
  maxPlayers: 4;
  status: 'waiting' | 'playing';
  createdAt: number;
}
